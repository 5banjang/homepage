document.addEventListener('DOMContentLoaded', () => {
    // --- Sidebar Navigation ---
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.content-section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');

            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');
        });
    });

    // --- Initial Load ---
    refreshAll();

    // --- Portfolio Logic ---
    const portfolioForm = document.getElementById('portfolio-upload-form');

    // Remove required attribute from title if present (logic handled in JS)
    const titleInput = document.getElementById('portfolio-title');
    if (titleInput) titleInput.removeAttribute('required');

    portfolioForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const category = document.getElementById('portfolio-category').value;
        let title = document.getElementById('portfolio-title').value;
        const fileBefore = document.getElementById('file-before').files[0];
        const fileAfter = document.getElementById('file-after').files[0];
        const submitBtn = portfolioForm.querySelector('button[type="submit"]');

        if (!fileAfter) return alert('Main image is required');

        if (!title.trim()) {
            title = `Untitled Work ${new Date().toLocaleDateString()}`;
        }

        // Loading State
        const originalBtnText = submitBtn.textContent;
        submitBtn.textContent = 'Uploading...';
        submitBtn.classList.add('blink-animation');
        submitBtn.disabled = true;

        try {
            // Pass File objects directly to saveToDB to preserve name/extension
            // const afterBlob = await fileToBlob(fileAfter); // Removed
            // let beforeBlob = null;
            // if (fileBefore) {
            //    beforeBlob = await fileToBlob(fileBefore);
            // }

            // saveToDB in db.js now handles the upload to Firebase Storage
            await saveToDB('portfolio', {
                category,
                title,
                afterBlob: fileAfter, // Pass File object
                beforeBlob: fileBefore || null, // Pass File object (or null if undefined)
                // createdAt added by db.js
            });

            alert('Uploaded Successfully!');
            portfolioForm.reset();
            refreshAll();
        } catch (error) {
            console.error(error);
            alert('Upload Failed: ' + error.message);
        } finally {
            // Reset Button State
            submitBtn.textContent = originalBtnText;
            submitBtn.classList.remove('blink-animation');
            submitBtn.disabled = false;
        }
    });

    // --- Blog Logic ---
    const blogForm = document.getElementById('blog-form');

    // Initialize Quill with Custom Toolbar
    const quill = new Quill('#editor-container', {
        theme: 'snow',
        modules: {
            toolbar: {
                container: '#toolbar-container', // Selector for custom toolbar
                handlers: {
                    image: imageHandler,
                    'sticker-dummy': () => alert('스티커 기능은 준비 중입니다.'),
                    'divider-dummy': () => {
                        const range = quill.getSelection();
                        quill.insertEmbed(range.index, 'divider', true); // Custom divider embed needed or simple HR
                        // For simplicity, insert HR via HTML or just text
                        // Quill doesn't have default HR embed in 1.3.6 without custom blot.
                        // Let's try inserting a horizontal rule via clipboard or specialized blot.
                        // Simpler fallback:
                        quill.clipboard.dangerouslyPasteHTML(range.index, '<hr>');
                    }
                }
            }
        },
        placeholder: '글감과 함께 나의 일상을 기록해보세요!'
    });

    // Custom Image Handler
    function imageHandler() {
        const input = document.getElementById('quill-image-upload');
        input.click();

        input.onchange = async () => {
            const file = input.files[0];
            if (file) {
                try {
                    const range = quill.getSelection(true); // Ensure focus

                    // Upload
                    // const blob = await fileToBlob(file); // Use file directly if uploadFile supports it
                    // db.js uploadFile now supports File or Blob. 
                    // But here we call uploadFile directly? No, we call uploadFile from db.js?
                    // Wait, admin.js doesn't import uploadFile. It's global from db.js.
                    // Let's check if uploadFile is global. Yes.

                    const url = await uploadFile(file, 'blog-content-images');

                    // Insert
                    quill.insertEmbed(range.index, 'image', url);
                    quill.setSelection(range.index + 1);
                } catch (error) {
                    console.error('Image upload failed:', error);
                    alert('Image upload failed');
                }
            }
        };
    }

    const blogTitle = document.getElementById('blog-title');
    const blogImageInput = document.getElementById('blog-image'); // Hidden input
    const btnUploadCover = document.getElementById('btn-upload-cover');
    const coverFileName = document.getElementById('cover-file-name');
    const coverPreview = document.getElementById('cover-preview');
    const coverPreviewImg = coverPreview.querySelector('img');

    // Trigger hidden input when button is clicked
    if (btnUploadCover) {
        btnUploadCover.addEventListener('click', () => {
            blogImageInput.click();
        });
    }

    // Handle file selection
    if (blogImageInput) {
        blogImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                coverFileName.textContent = file.name;
                // Show preview
                const reader = new FileReader();
                reader.onload = (e) => {
                    coverPreviewImg.src = e.target.result;
                    coverPreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else {
                coverFileName.textContent = '선택된 파일 없음';
                coverPreview.style.display = 'none';
            }
        });
    }

    blogForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = blogTitle.value;
        // Get HTML content from Quill
        const content = quill.root.innerHTML;
        const imageFile = blogImageInput.files[0];

        try {
            const data = {
                title,
                content,
                imageBlob: imageFile // saveToDB handles this (File object)
            };

            await saveToDB('blog', data);

            alert('Published Successfully!');
            blogForm.reset();
            quill.setContents([]); // Clear editor
            await refreshAll();

            // Scroll to list to show the new item
            document.querySelector('#blog-manager .list-panel').scrollIntoView({ behavior: 'smooth' });
        } catch (error) {
            console.error(error);
            alert('Publish Failed: ' + error.message);
        }
    });

    // --- Data Fetching & Rendering ---
    async function refreshAll() {
        try {
            const portfolioItems = await getAllFromDB('portfolio');
            const blogItems = await getAllFromDB('blog');

            // Update Stats
            document.getElementById('stat-photos').textContent = portfolioItems.filter(i => i.category === 'photography').length;
            document.getElementById('stat-videos').textContent = portfolioItems.filter(i => i.category === 'videography').length;
            document.getElementById('stat-blog').textContent = blogItems.length;

            // Render Tables
            renderPortfolioTable(portfolioItems);
            renderBlogTable(blogItems);
        } catch (e) {
            console.error("Error refreshing data:", e);
        }
    }

    function renderPortfolioTable(items) {
        const tbody = document.querySelector('#portfolio-table tbody');
        tbody.innerHTML = '';

        // Sort desc
        items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        items.forEach(item => {
            const tr = document.createElement('tr');
            // Use URL from Firebase
            const imgUrl = item.afterUrl;

            // Check if video
            const isVideo = imgUrl.includes('.mp4') || imgUrl.includes('.webm') || imgUrl.includes('.mov');

            let previewHtml;
            if (isVideo) {
                previewHtml = `<video src="${imgUrl}" muted loop onmouseover="this.play()" onmouseout="this.pause()" style="width: 50px; height: 50px; object-fit: cover; cursor: pointer;" class="lightbox-trigger" data-type="video" data-src="${imgUrl}"></video>`;
            } else {
                previewHtml = `<img src="${imgUrl}" alt="preview" style="width: 50px; height: 50px; object-fit: cover; cursor: pointer;" class="lightbox-trigger" data-type="image" data-src="${imgUrl}">`;
            }

            tr.innerHTML = `
                <td>${previewHtml}</td>
                <td>${item.title}</td>
                <td><span class="badge">${item.category}</span></td>
                <td>${new Date(item.createdAt).toLocaleDateString()}</td>
                <td>
                    <button class="btn-delete" data-id="${item.id}" data-store="portfolio">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        attachDeleteListeners();
    }

    function renderBlogTable(items) {
        const tbody = document.querySelector('#blog-table tbody');
        tbody.innerHTML = '';

        items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.title}</td>
                <td>${new Date(item.createdAt).toLocaleDateString()}</td>
                <td>
                    <button class="btn-delete" data-id="${item.id}" data-store="blog">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        attachDeleteListeners();
    }

    function attachDeleteListeners() {
        // Delete Listeners
        const deleteBtns = document.querySelectorAll('.btn-delete');
        deleteBtns.forEach(btn => {
            btn.onclick = async () => {
                if (confirm('Are you sure you want to delete this item?')) {
                    const id = btn.getAttribute('data-id');
                    const store = btn.getAttribute('data-store');

                    // Visual feedback
                    const originalText = btn.textContent;
                    btn.textContent = 'Deleting...';
                    btn.disabled = true;

                    try {
                        await deleteFromDB(store, id);
                        // Success feedback (optional, but refreshAll handles the UI update)
                        await refreshAll();
                    } catch (error) {
                        console.error("Delete failed:", error);
                        alert('Delete failed: ' + error.message);
                        // Revert button state on error
                        btn.textContent = originalText;
                        btn.disabled = false;
                    }
                }
            };
        });

        // Lightbox Listeners
        const lightboxTriggers = document.querySelectorAll('.lightbox-trigger');
        lightboxTriggers.forEach(trigger => {
            trigger.addEventListener('click', () => {
                const src = trigger.getAttribute('data-src');
                const type = trigger.getAttribute('data-type');
                openLightbox(src, type);
            });
        });
    }

    // --- Lightbox Logic ---
    const lightbox = document.getElementById('lightbox');
    const lightboxContent = lightbox.querySelector('.lightbox-content');
    const lightboxClose = lightbox.querySelector('.lightbox-close');

    function openLightbox(src, type) {
        lightboxContent.innerHTML = ''; // Clear previous content

        if (type === 'video') {
            const video = document.createElement('video');
            video.src = src;
            video.controls = true;
            video.autoplay = true;
            video.loop = true;
            // video.muted = true; // Optional: mute by default? User asked for autoplay, usually requires mute or user interaction. 
            // But since it's a click interaction, we can try unmuted or let user decide. 
            // User said "immediately play", usually implies sound if it's a video, but let's stick to standard autoplay policies if needed.
            // Actually, user didn't specify mute. Let's try unmuted but if browser blocks, it blocks.
            // Safe bet: muted=false (default), but if it doesn't play, we might need muted=true. 
            // However, since the user clicked, audio is allowed.
            lightboxContent.appendChild(video);
        } else {
            const img = document.createElement('img');
            img.src = src;
            lightboxContent.appendChild(img);
        }

        lightbox.classList.add('active');
    }

    // Close Lightbox
    if (lightboxClose) {
        lightboxClose.addEventListener('click', closeLightbox);
    }

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });

    function closeLightbox() {
        lightbox.classList.remove('active');
        lightboxContent.innerHTML = ''; // Stop video playback
    }
});
