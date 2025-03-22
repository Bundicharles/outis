const API_URL = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and script running');

    // Profile Dropdown
    window.toggleProfileMenu = function () {
        console.log('toggleProfileMenu called');
        const profileMenu = document.getElementById('profileMenu');
        if (profileMenu) {
            console.log('Profile menu found, current display:', profileMenu.style.display);
            profileMenu.style.display = profileMenu.style.display === 'block' ? 'none' : 'block';
            console.log('New display:', profileMenu.style.display);
        } else {
            console.error('Profile menu element not found');
        }
    };

    window.logout = function () {
        console.log('Logout called');
        localStorage.removeItem('token');
        window.location.href = 'index.html';
    };

    // Token-based visibility logic
    const token = localStorage.getItem('token');
    const profileElement = document.querySelector('.profile');
    const authButtons = document.getElementById('authButtons');
    if (token) {
        console.log('User is logged in, token:', token);
        if (profileElement) {
            profileElement.style.display = 'block';
            console.log('Profile element shown');
        }
        if (authButtons) {
            authButtons.style.display = 'none';
            console.log('Auth buttons hidden');
        }
        const commentForm = document.getElementById('commentForm');
        if (commentForm) commentForm.style.display = 'block';
    } else {
        console.log('No token found, showing login and signup buttons');
        if (profileElement) {
            profileElement.style.display = 'none';
        }
        if (authButtons) {
            authButtons.style.display = 'block';
        }
    }

    // Attach event listeners for login/signup
    document.getElementById('loginBtn')?.addEventListener('click', () => {
        console.log('Login button clicked');
        window.location.href = 'login.html';
    });

    document.getElementById('signupBtn')?.addEventListener('click', () => {
        console.log('Signup button clicked');
        window.location.href = 'signup.html';
    });

    // Initialize Quill Editor on create.html
    if (window.location.pathname.endsWith('create.html')) {
        if (typeof Quill !== 'undefined') {
            const quill = new Quill('#editor', {
                theme: 'snow',
                modules: {
                    toolbar: [
                        [{ header: [1, 2, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        ['link', 'image', 'video'],
                        [{ list: 'ordered' }, { list: 'bullet' }],
                        ['clean']
                    ]
                }
            });
            console.log('Quill editor initialized');
        } else {
            console.error('Quill library not loaded');
        }
    }

    // Handle Sign Up
    if (window.location.pathname.endsWith('signup.html')) {
        const signupForm = document.getElementById('signupForm');
        if (signupForm) {
            signupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;

                try {
                    const response = await fetch(`${API_URL}/api/signup`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    const data = await response.json();
                    alert(data.message);
                    if (response.status === 201) window.location.href = 'login.html';
                } catch (error) {
                    console.error('Error during signup:', error);
                    alert('Failed to sign up. Check the console for details.');
                }
            });
        }
    }

    // Handle Login
    if (window.location.pathname.endsWith('login.html')) {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;

                try {
                    const response = await fetch(`${API_URL}/api/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    const data = await response.json();
                    if (response.ok) {
                        localStorage.setItem('token', data.token);
                        window.location.href = 'index.html';
                    } else {
                        alert(data.message);
                    }
                } catch (error) {
                    console.error('Error during login:', error);
                    alert('Failed to log in. Check the console for details.');
                }
            });
        }
    }

    // Handle Create Blog with Quill Content
    if (window.location.pathname.endsWith('create.html')) {
        const createBlogForm = document.getElementById('createBlogForm');
        if (createBlogForm) {
            createBlogForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('Create Blog form submitted');

                const title = document.getElementById('title').value;
                const category = document.getElementById('category').value;
                const content = document.querySelector('.ql-editor')?.innerHTML || '';

                const token = localStorage.getItem('token');
                if (!token) {
                    alert('No token found. Please log in again.');
                    window.location.href = 'login.html';
                    return;
                }

                try {
                    const response = await fetch(`${API_URL}/api/blogs`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token.trim()}`
                        },
                        body: JSON.stringify({ title, category, content })
                    });
                    const data = await response.json();
                    if (response.status === 403 && data.message === 'Invalid token') {
                        alert('Your session has expired. Please log in again.');
                        localStorage.removeItem('token');
                        window.location.href = 'login.html';
                        return;
                    }

                    alert(response.ok ? 'Blog created!' : `Error creating blog: ${data.message || 'Unknown error'}`);
                    if (response.ok) window.location.href = 'index.html';
                } catch (error) {
                    console.error('Error creating blog:', error);
                    alert('Failed to create blog. Check the console for details.');
                }
            });
        }
    }

    // Fetch and Display Blogs
    if (window.location.pathname.endsWith('index.html')) {
        window.fetchAndRenderBlogs = async function (category = '') {
            try {
                const response = await fetch(`${API_URL}/api/blogs${category ? `?category=${category}` : ''}`);
                const blogs = await response.json();
                console.log('Fetched Blogs:', blogs);
                const blogsList = document.getElementById('blogsList');
                blogsList.innerHTML = blogs.map(blog => `
                    <div class="blog-card">
                        <h3><a href="blog.html?id=${blog.id}">${blog.title}</a></h3>
                        <p>By ${blog.username} on ${new Date(blog.created_at).toLocaleDateString()}</p>
                        <div class="metrics">
                            <span>Likes: ${blog.likes || 0}</span>
                            <span>Comments: ${blog.comment_count || 0}</span>
                            <span>Views: ${blog.views || 0}</span>
                        </div>
                    </div>
                `).join('');
            } catch (error) {
                console.error('Error fetching blogs:', error);
            }
        };
        fetchAndRenderBlogs();
    }

    // Fetch and Display a Single Blog
    if (window.location.pathname.endsWith('blog.html')) {
        const fetchBlog = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const blogId = urlParams.get('id');

            try {
                const response = await fetch(`${API_URL}/api/blogs/${blogId}`);
                const blog = await response.json();

                document.getElementById('blogTitle').textContent = blog.title;
                document.getElementById('blogAuthor').textContent = blog.username;
                document.getElementById('blogDate').textContent = new Date(blog.created_at).toLocaleDateString();
                document.getElementById('blogContent').innerHTML = blog.content;
                document.getElementById('likeCount').textContent = blog.likes || 0;

                const commentsList = document.getElementById('commentsList');
                commentsList.innerHTML = blog.comments.map(comment => `
                    <div class="comment">
                        <p><strong>${comment.username}</strong> on ${new Date(comment.created_at).toLocaleDateString()}</p>
                        <p>${comment.content}</p>
                    </div>
                `).join('');
            } catch (error) {
                console.error('Error fetching blog:', error);
            }
        };
        fetchBlog();

        document.getElementById('likeBtn')?.addEventListener('click', async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const blogId = urlParams.get('id');

            try {
                const response = await fetch(`${API_URL}/api/blogs/${blogId}/like`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                const data = await response.json();
                alert(data.message);
                if (response.ok) fetchBlog();
            } catch (error) {
                console.error('Error liking blog:', error);
            }
        });

        document.getElementById('commentForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const urlParams = new URLSearchParams(window.location.search);
            const blogId = urlParams.get('id');
            const content = document.getElementById('commentContent').value;

            try {
                const response = await fetch(`${API_URL}/api/blogs/${blogId}/comment`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ content })
                });
                const data = await response.json();
                alert(data.message);
                if (response.ok) {
                    document.getElementById('commentContent').value = '';
                    fetchBlog();
                }
            } catch (error) {
                console.error('Error adding comment:', error);
            }
        });
    }
});