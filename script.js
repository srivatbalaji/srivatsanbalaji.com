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
        
        // Define button configurations
        const buttons = [
            { 
                image: 'images/cokebutton.png', 
                text: 'What I\'m listening to', 
                link: 'spotify.html',
                size: 140,
                textSize: '1rem',
                padding: '1.5rem'
            },
            { 
                image: 'images/mail.png', 
                text: 'Email me', 
                link: 'contact.html',
                size: 140,
                textSize: '1rem',
                padding: '1.5rem'
            },
            { 
                image: 'images/drillbutton.png', 
                text: 'Linkedin', 
                link: 'https://www.linkedin.com/in/srivatsan-balaji3/',
                size: 140,
                textSize: '1rem',
                padding: '1.5rem'
            },
            { 
                image: 'images/tsbutton.png', 
                text: 'GitHub', 
                link: 'https://github.com/srivatbalaji',
                size: 140,
                textSize: '1rem',
                padding: '1.5rem'
            }
        ];

        // Function to check if a position overlaps with existing buttons
        const isOverlapping = (x, y, size, existingButtons) => {
            const minDistance = size * 1.8; // Optimal spacing between button centers
            return existingButtons.some(button => {
                const buttonX = parseInt(button.style.left);
                const buttonY = parseInt(button.style.top);
                const distance = Math.sqrt(Math.pow(x - buttonX, 2) + Math.pow(y - buttonY, 2));
                return distance < minDistance;
            });
        };

        // Array to store existing button positions
        const existingButtons = [];
        
        buttons.forEach((buttonConfig) => {
            const button = document.createElement('div');
            button.className = 'random-button';
            
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
            
            // Position the button randomly within safe bounds of main-content area
            const buttonSize = buttonConfig.size || 160;
            const buttonPadding = buttonConfig.padding ? parseInt(buttonConfig.padding) : 32; // Default 2rem = 32px
            const totalButtonWidth = buttonSize + (buttonPadding * 2);
            const totalButtonHeight = buttonSize + (buttonPadding * 2) + 30; // Extra for text
            
            // Get main-content dimensions
            const mainRect = main.getBoundingClientRect();
            const contentWidth = mainRect.width;
            const contentHeight = mainRect.height;
            
            // Calculate safe bounds within main-content
            const maxX = contentWidth - totalButtonWidth - 20; // 20px padding from edge
            const maxY = contentHeight - totalButtonHeight - 20;
            const minX = 20;
            const minY = 20;
            
            // Find a non-overlapping position
            let x, y;
            let attempts = 0;
            const maxAttempts = 50;
            
            do {
                x = minX + Math.random() * (maxX - minX);
                y = minY + Math.random() * (maxY - minY);
                attempts++;
            } while (isOverlapping(x, y, totalButtonWidth, existingButtons) && attempts < maxAttempts);
            
            // Position relative to main-content container
            button.style.left = `${x}px`;
            button.style.top = `${y}px`;
            
            // Apply specific position adjustments based on button type
            if (buttonConfig.text === 'GitHub') {
                // Move GitHub up (closer to tape)
                button.style.top = `${parseFloat(button.style.top) - 80}px`;
            } else if (buttonConfig.text === 'Linkedin') {
                // Move LinkedIn to the right
                button.style.left = `${parseFloat(button.style.left) + 80}px`;
            } else if (buttonConfig.text === 'Email me') {
                // Move Email me to the right
                button.style.left = `${parseFloat(button.style.left) + 80}px`;
            } else if (buttonConfig.text === 'What I\'m listening to') {
                // Move What I'm listening to to the right
                button.style.left = `${parseFloat(button.style.left) + 80}px`;
            }
            
            // Add to existing buttons array
            existingButtons.push(button);
            
            main.appendChild(button);
            makeDraggable(button);
        });
    }
});