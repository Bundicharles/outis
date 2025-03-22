
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = 3001;
const SECRET_KEY = 'your-secret-key';

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'public/uploads');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// SQLite Database Setup
const db = new sqlite3.Database('database.db');
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS blogs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        content TEXT,
        category TEXT,
        author_id INTEGER,
        created_at TEXT,
        views INTEGER DEFAULT 0,
        FOREIGN KEY (author_id) REFERENCES users(id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        blog_id INTEGER,
        user_id INTEGER,
        FOREIGN KEY (blog_id) REFERENCES blogs(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        blog_id INTEGER,
        user_id INTEGER,
        content TEXT,
        created_at TEXT,
        FOREIGN KEY (blog_id) REFERENCES blogs(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Token malformed' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        req.user = user;
        next();
    });
};

// Routes

// Sign Up
app.post('/api/signup', (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 8);

    db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hashedPassword], function (err) {
        if (err) {
            console.error('Error during signup:', err);
            return res.status(400).json({ message: 'Username already exists' });
        }
        res.status(201).json({ message: 'User created' });
    });
});

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err) {
            console.error('Error during login:', err);
            return res.status(500).json({ message: 'Server error during login' });
        }
        if (!user) return res.status(400).json({ message: 'User not found' });

        const isPasswordValid = bcrypt.compareSync(password, user.password);
        if (!isPasswordValid) return res.status(400).json({ message: 'Invalid password' });

        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token });
    });
});

// Image Upload Endpoint
app.post('/api/upload-image', authenticateToken, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ url: imageUrl });
});

// Create a Blog Post
app.post('/api/blogs', authenticateToken, (req, res) => {
    const { title, content, category } = req.body;
    const author_id = req.user.id;
    const created_at = new Date().toISOString();

    console.log('Received blog creation request:', { title, content, category, author_id, created_at });

    db.run(
        `INSERT INTO blogs (title, content, category, author_id, created_at, views) VALUES (?, ?, ?, ?, ?, ?)`,
        [title, content, category, author_id, created_at, 0],
        function (err) {
            if (err) {
                console.error('Error inserting blog into database:', err);
                return res.status(500).json({ message: `Error creating blog: ${err.message}` });
            }
            console.log('Blog created successfully with ID:', this.lastID);
            res.status(201).json({ id: this.lastID });
        }
    );
});

// Get All Blogs
app.get('/api/blogs', (req, res) => {
    const category = req.query.category;
    let query = `SELECT blogs.*, users.username, 
                 (SELECT COUNT(*) FROM likes WHERE likes.blog_id = blogs.id) as likes,
                 (SELECT COUNT(*) FROM comments WHERE comments.blog_id = blogs.id) as comment_count
                 FROM blogs JOIN users ON blogs.author_id = users.id`;
    let params = [];

    if (category) {
        query += ` WHERE blogs.category = ?`;
        params.push(category);
    }

    query += ` ORDER BY blogs.created_at DESC`;

    db.all(query, params, (err, blogs) => {
        if (err) {
            console.error('Error fetching blogs:', err);
            return res.status(500).json({ message: 'Error fetching blogs' });
        }
        res.json(blogs);
    });
});

// Get a Single Blog by ID
app.get('/api/blogs/:id', (req, res) => {
    const { id } = req.params;

    // Increment views
    db.run(`UPDATE blogs SET views = views + 1 WHERE id = ?`, [id], (err) => {
        if (err) console.error('Error incrementing views:', err);
    });

    db.get(
        `SELECT blogs.*, users.username FROM blogs JOIN users ON blogs.author_id = users.id WHERE blogs.id = ?`,
        [id],
        (err, blog) => {
            if (err) {
                console.error('Error fetching blog:', err);
                return res.status(500).json({ message: 'Error fetching blog' });
            }
            if (!blog) return res.status(404).json({ message: 'Blog not found' });

            db.get(`SELECT COUNT(*) as likes FROM likes WHERE blog_id = ?`, [id], (err, likeResult) => {
                if (err) {
                    console.error('Error counting likes:', err);
                    return res.status(500).json({ message: 'Error counting likes' });
                }
                db.all(
                    `SELECT comments.*, users.username FROM comments JOIN users ON comments.user_id = users.id WHERE blog_id = ? ORDER BY comments.created_at DESC`,
                    [id],
                    (err, comments) => {
                        if (err) {
                            console.error('Error fetching comments:', err);
                            return res.status(500).json({ message: 'Error fetching comments' });
                        }
                        res.json({ ...blog, likes: likeResult.likes, comments });
                    }
                );
            });
        }
    );
});

// Like a Blog
app.post('/api/blogs/:id/like', authenticateToken, (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;

    db.get(`SELECT * FROM likes WHERE blog_id = ? AND user_id = ?`, [id, user_id], (err, like) => {
        if (err) {
            console.error('Error checking like:', err);
            return res.status(500).json({ message: 'Error checking like' });
        }
        if (like) return res.status(400).json({ message: 'Already liked' });

        db.run(`INSERT INTO likes (blog_id, user_id) VALUES (?, ?)`, [id, user_id], (err) => {
            if (err) {
                console.error('Error liking blog:', err);
                return res.status(500).json({ message: 'Error liking blog' });
            }
            res.json({ message: 'Liked' });
        });
    });
});

// Comment on a Blog
app.post('/api/blogs/:id/comment', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    const user_id = req.user.id;
    const created_at = new Date().toISOString();

    db.run(
        `INSERT INTO comments (blog_id, user_id, content, created_at) VALUES (?, ?, ?, ?)`,
        [id, user_id, content, created_at],
        (err) => {
            if (err) {
                console.error('Error adding comment:', err);
                return res.status(500).json({ message: 'Error adding comment' });
            }
            res.json({ message: 'Comment added' });
        }
    );
});

// Get Blogs by User (for manage.html)
app.get('/api/user/blogs', authenticateToken, (req, res) => {
    const user_id = req.user.id;
    db.all(
        `SELECT blogs.*, users.username,
         (SELECT COUNT(*) FROM likes WHERE likes.blog_id = blogs.id) as likes,
         (SELECT COUNT(*) FROM comments WHERE comments.blog_id = blogs.id) as comment_count
         FROM blogs JOIN users ON blogs.author_id = users.id
         WHERE blogs.author_id = ?
         ORDER BY blogs.created_at DESC`,
        [user_id],
        (err, blogs) => {
            if (err) {
                console.error('Error fetching user blogs:', err);
                return res.status(500).json({ message: 'Error fetching blogs' });
            }
            res.json(blogs);
        }
    );
});

// Delete a Blog
app.delete('/api/blogs/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;

    db.get(`SELECT * FROM blogs WHERE id = ? AND author_id = ?`, [id, user_id], (err, blog) => {
        if (err) {
            console.error('Error checking blog ownership:', err);
            return res.status(500).json({ message: 'Error checking blog ownership' });
        }
        if (!blog) return res.status(403).json({ message: 'Unauthorized or blog not found' });

        db.run(`DELETE FROM blogs WHERE id = ?`, [id], (err) => {
            if (err) {
                console.error('Error deleting blog:', err);
                return res.status(500).json({ message: 'Error deleting blog' });
            }
            db.run(`DELETE FROM likes WHERE blog_id = ?`, [id]);
            db.run(`DELETE FROM comments WHERE blog_id = ?`, [id]);
            res.json({ message: 'Blog deleted' });
        });
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});