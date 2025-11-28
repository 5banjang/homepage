document.addEventListener('DOMContentLoaded', () => {
    // --- Mobile Menu Logic ---
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const mainNav = document.querySelector('.main-nav');

    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', () => {
            mobileMenuToggle.classList.toggle('active');
            mainNav.classList.toggle('active');
            document.body.style.overflow = mainNav.classList.contains('active') ? 'hidden' : '';
        });
    }

    // Close menu when clicking a link
    const navLinks = document.querySelectorAll('.main-nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (mainNav.classList.contains('active')) {
                mobileMenuToggle.classList.remove('active');
                mainNav.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });

    // --- Navigation Tabs ---
    const tabs = document.querySelectorAll('.main-nav a[data-tab]');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = tab.getAttribute('data-tab');

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            contents.forEach(content => content.classList.remove('active'));
            const targetContent = document.getElementById(targetId);
            if (targetContent) targetContent.classList.add('active');

            const portfolioSection = document.getElementById('portfolio');
            portfolioSection.scrollIntoView({ behavior: 'smooth' });
        });
    });

    // --- Lightbox Logic ---
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxVideo = document.getElementById('lightbox-video');
    const closeLightbox = document.querySelector('.close-lightbox');

    function openLightbox(url, type = 'image', extraData = null) {
        lightbox.style.display = 'flex';
        lightboxImg.style.display = 'none';
        lightboxVideo.style.display = 'none';
        const lightboxSlider = document.getElementById('lightbox-slider');
        lightboxSlider.style.display = 'none';

        if (type === 'video') {
            lightboxVideo.style.display = 'block';
            lightboxVideo.src = url;
        } else if (type === 'slider') {
            lightboxSlider.style.display = 'block';
            lightboxSlider.innerHTML = `
                <div class="ba-before" style="background-image: url('${extraData.beforeUrl}')"></div>
                <div class="ba-after" style="background-image: url('${url}')"></div>
                <div class="ba-handle"></div>
            `;
            // Re-initialize slider logic for the lightbox instance
            // We need to pass the lightbox-slider element itself, not a wrapper div
            // But initSlider expects a wrapper with .ba-slider inside. 
            // Let's adjust initSlider or wrapper.
            // Actually initSlider expects 'element' and looks for .ba-slider inside.
            // So we can wrap the content or adjust initSlider.
            // Simpler: Let's make initSlider accept the slider element directly if it has the class.

            initSlider(lightbox, true); // Pass true to indicate direct binding or handle logic inside
        } else {
            lightboxImg.style.display = 'block';
            lightboxImg.src = url;
        }
    }

    closeLightbox.addEventListener('click', () => {
        lightbox.style.display = 'none';
        lightboxVideo.pause();
        lightboxVideo.src = "";
    });

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            lightbox.style.display = 'none';
            lightboxVideo.pause();
            lightboxVideo.src = "";
        }
    });

    // --- Rendering Logic ---
    loadPortfolio();
    loadBlog();

    async function loadPortfolio() {
        try {
            const items = await getAllFromDB('portfolio');
            // Sort by date desc
            items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            ['photography', 'videography'].forEach(cat => {
                const container = document.querySelector(`#${cat} .gallery-grid`);
                if (!container) return;

                container.innerHTML = ''; // Clear placeholders
                const catItems = items.filter(i => i.category === cat);

                catItems.forEach(data => {
                    const item = createPortfolioItem(data);
                    container.appendChild(item);
                });
            });
        } catch (e) {
            console.error("Error loading portfolio:", e);
        }
    }

    function createPortfolioItem(data) {
        const div = document.createElement('div');
        div.className = 'gallery-item';

        // Data from Firebase has 'afterUrl' and 'beforeUrl' directly
        const afterUrl = data.afterUrl;

        if (data.beforeUrl) {
            const beforeUrl = data.beforeUrl;
            // Create Before/After Slider
            div.innerHTML = `
                <div class="ba-slider">
                    <div class="ba-before" style="background-image: url('${beforeUrl}')"></div>
                    <div class="ba-after" style="background-image: url('${afterUrl}')"></div>
                    <div class="ba-handle"></div>
                </div>
            `;

            // Pass onExpand callback to initSlider
            initSlider(div, false, () => {
                openLightbox(afterUrl, 'slider', { beforeUrl });
            });
        } else {
            // Standard Image/Video
            // Simple check for video extension in URL
            const isVideo = afterUrl.includes('.mp4') || afterUrl.includes('.webm') || afterUrl.includes('.mov');

            if (isVideo) {
                div.innerHTML = `<video src="${afterUrl}" muted loop onmouseover="this.play()" onmouseout="this.pause()"></video>`;
            } else {
                div.innerHTML = `<img src="${afterUrl}" alt="${data.title}">`;
            }

            // Add click listener for Lightbox
            div.addEventListener('click', () => {
                openLightbox(afterUrl, isVideo ? 'video' : 'image');
            });
        }
        return div;
    }

    function initSlider(element, isLightbox = false, onExpand = null) {
        let slider, after, handle;

        if (isLightbox) {
            slider = document.getElementById('lightbox-slider');
        } else {
            slider = element.querySelector('.ba-slider');
        }

        if (!slider) return;

        after = slider.querySelector('.ba-after');
        handle = slider.querySelector('.ba-handle');

        let active = false;
        let startX = 0;
        let isDragging = false;

        // Mouse events
        slider.addEventListener('mousedown', (e) => {
            active = true;
            startX = e.pageX;
            isDragging = false;
            // Don't stop propagation yet, we might want to bubble up if it's a click
            // But we need to prevent default drag behavior
            e.preventDefault();
        });

        window.addEventListener('mouseup', (e) => {
            if (active && !isDragging && onExpand) {
                // If mouse went down and up without dragging, treat as click
                onExpand();
            }
            active = false;
        });

        slider.addEventListener('mousemove', (e) => {
            if (!active) return;

            let x = e.pageX - slider.getBoundingClientRect().left;

            // Check if moved significantly to consider it a drag
            if (Math.abs(e.pageX - startX) > 5) {
                isDragging = true;
            }

            scrollIt(x, slider);
        });

        // Touch events
        slider.addEventListener('touchstart', (e) => {
            active = true;
            startX = e.touches[0].pageX;
            isDragging = false;
            // e.preventDefault(); // Might block scrolling page, be careful
        });

        window.addEventListener('touchend', (e) => {
            if (active && !isDragging && onExpand) {
                onExpand();
            }
            active = false;
        });

        slider.addEventListener('touchmove', (e) => {
            if (!active) return;

            let x = e.touches[0].pageX - slider.getBoundingClientRect().left;

            if (Math.abs(e.touches[0].pageX - startX) > 5) {
                isDragging = true;
            }

            scrollIt(x, slider);
        });

        function scrollIt(x, slider) {
            let transform = Math.max(0, (Math.min(x, slider.offsetWidth)));
            after.style.width = transform + "px";
            handle.style.left = transform + "px";
        }
    }

    // --- Blog Modal Logic ---
    const blogModal = document.getElementById('blog-modal');
    const closeBlogModal = document.querySelector('.close-blog-modal');
    const blogModalTitle = document.getElementById('blog-modal-title');
    const blogModalDate = document.getElementById('blog-modal-date');
    const blogModalBody = document.getElementById('blog-modal-body');

    function openBlogModal(data) {
        blogModalTitle.textContent = data.title;
        blogModalDate.textContent = new Date(data.createdAt).toLocaleDateString();
        blogModalBody.innerHTML = data.content; // Inject HTML content
        blogModal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    closeBlogModal.addEventListener('click', () => {
        blogModal.style.display = 'none';
        document.body.style.overflow = '';
    });

    window.addEventListener('click', (e) => {
        if (e.target === blogModal) {
            blogModal.style.display = 'none';
            document.body.style.overflow = '';
        }
    });

    async function loadBlog() {
        try {
            const container = document.getElementById('blog-grid');
            const items = await getAllFromDB('blog');
            items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            container.innerHTML = '';
            items.forEach(data => {
                const imageUrl = data.imageUrl || '';

                // Strip HTML for preview
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = data.content;
                const plainText = tempDiv.textContent || tempDiv.innerText || '';

                const card = document.createElement('div');
                card.className = 'blog-card';
                // Make card clickable
                card.style.cursor = 'pointer';
                card.onclick = () => openBlogModal(data);

                card.innerHTML = `
                    ${imageUrl ? `<img src="${imageUrl}" style="width:100%; height:200px; object-fit:cover; margin-bottom:1rem;">` : ''}
                    <h3>${data.title}</h3>
                    <span class="blog-date">${new Date(data.createdAt).toLocaleDateString()}</span>
                    <p>${plainText.substring(0, 100)}...</p>
                `;
                container.appendChild(card);
            });
        } catch (e) {
            console.error("Error loading blog:", e);
        }
    }
});
