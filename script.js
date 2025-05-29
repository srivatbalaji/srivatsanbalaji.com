document.addEventListener('DOMContentLoaded', () => {
    // Make elements draggable
    const makeDraggable = (element) => {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        let startX, startY;
        let hasDragged = false;
        
        const dragMouseDown = (e) => {
            e = e || window.event;
            e.preventDefault();
            e.stopPropagation();
            hasDragged = false;
            
            // Get the mouse cursor position at startup
            pos3 = e.clientX;
            pos4 = e.clientY;
            startX = e.clientX;
            startY = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
            
            // Hide text while dragging
            const textElement = element.querySelector('.button-text');
            if (textElement) {
                textElement.style.opacity = '0';
            }
        };

        const elementDrag = (e) => {
            e = e || window.event;
            e.preventDefault();
            
            // Calculate the new cursor position
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            
            // Check if we've moved enough to consider this a drag
            const distance = Math.sqrt(Math.pow(e.clientX - startX, 2) + Math.pow(e.clientY - startY, 2));
            if (distance > 3) {
                hasDragged = true;
            }
            
            // Set the element's new position
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        };

        const closeDragElement = (e) => {
            // Stop moving when mouse button is released
            document.onmouseup = null;
            document.onmousemove = null;
            
            // Show text again after dragging
            const textElement = element.querySelector('.button-text');
            if (textElement) {
                textElement.style.opacity = '';
            }
            
            // If we dragged, prevent the click
            if (hasDragged) {
                e.stopPropagation();
                e.preventDefault();
            }
        };

        const handleClick = (e) => {
            // Only navigate if we haven't dragged
            if (!hasDragged) {
                const buttonConfig = element.dataset.buttonConfig ? JSON.parse(element.dataset.buttonConfig) : null;
                if (buttonConfig && buttonConfig.link) {
                    if (buttonConfig.link.startsWith('http')) {
                        window.open(buttonConfig.link, '_blank');
                    } else {
                        window.location.href = buttonConfig.link;
                    }
                }
            }
            hasDragged = false;
        };

        element.onmousedown = dragMouseDown;
        element.addEventListener('click', handleClick);
    };

    // Only run this on the homepage
    if (!document.querySelector('main').classList.contains('content-page')) {
        const main = document.querySelector('main');
        console.log('Creating buttons on homepage');
        
        // Define button configurations
        const buttons = [
            { 
                image: 'images/cokebutton.png', 
                text: 'Spotify', 
                link: 'spotify.html',
                size: 180,
                textSize: '1rem',
                padding: '2rem'
            },
            { 
                image: 'images/mail.png', 
                text: 'Email me', 
                link: 'contact.html',
                size: 180,
                textSize: '1rem',
                padding: '2rem'
            },
            { 
                image: 'images/drillbutton.png', 
                text: 'Linkedin', 
                link: 'https://www.linkedin.com/in/srivatsan-balaji3/',
                size: 180,
                textSize: '1rem',
                padding: '2rem'
            },
            { 
                image: 'images/tsbutton.png', 
                text: 'Github', 
                link: 'https://github.com/srivatbalaji',
                size: 180,
                textSize: '1rem',
                padding: '1rem'
            }
        ];
        
        buttons.forEach((buttonConfig, index) => {
            console.log(`Creating button ${index + 1}: ${buttonConfig.text}`);
            const button = document.createElement('div');
            button.className = 'random-button draggable';
            
            // Apply custom padding if specified
            if (buttonConfig.padding) {
                button.style.padding = buttonConfig.padding;
            }
            
            // Store button config in data attribute for click handler
            button.dataset.buttonConfig = JSON.stringify(buttonConfig);
            
            const icon = document.createElement('div');
            icon.className = 'button-icon';
            
            // Apply custom size if specified
            if (buttonConfig.size) {
                icon.style.width = `${buttonConfig.size}px`;
                icon.style.height = `${buttonConfig.size}px`;
            }
            
            const img = document.createElement('img');
            img.src = buttonConfig.image;
            img.alt = buttonConfig.text;
            icon.appendChild(img);
            
            const text = document.createElement('div');
            text.className = 'button-text';
            text.textContent = buttonConfig.text;
            
            // Apply custom text size if specified
            if (buttonConfig.textSize) {
                text.style.fontSize = buttonConfig.textSize;
            }
            
            button.appendChild(icon);
            button.appendChild(text);
            
            // Position the button randomly within safe bounds
            const buttonSize = buttonConfig.size || 160;
            const maxX = window.innerWidth - buttonSize - 100;
            const maxY = window.innerHeight - buttonSize - 100;
            
            // Use initial position if specified, otherwise random
            const x = Math.max(50, Math.min(maxX, Math.random() * window.innerWidth - buttonSize));
            const y = Math.max(100, Math.min(maxY, Math.random() * window.innerHeight - buttonSize));
            
            console.log(`Positioning button ${buttonConfig.text} at x: ${x}, y: ${y}`);
            
            button.style.left = `${x}px`;
            button.style.top = `${y}px`;
            
            main.appendChild(button);
            makeDraggable(button);
        });
    }
});