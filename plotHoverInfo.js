import * as THREE from 'three';
import { cityData } from './cityData.js';
import { safeSetEmissive } from './threeJSGlobals.js';
import { llmDataManager } from './llmDataManager.js'; // Import LLM data manager

let raycaster, mouse, camera, scene, renderer;
let infoPanel, activePlotId;
let isMobile = false; // Flag to detect mobile environment
let touchTimeout = null; // Timeout for hiding panel on touch end
let touchStartPos = { x: 0, y: 0 }; // Store initial touch position
let isDragging = false; // Flag to track dragging state
const dragThreshold = 10; // Pixels threshold to detect drag

// Initialize hover functionality
export function initPlotHoverInfo(mainCamera, mainScene, mainRenderer) {
    // Store references
    camera = mainCamera;
    scene = mainScene;
    renderer = mainRenderer;

    // Simple mobile detection
    isMobile = window.innerWidth <= 768;

    // Create raycaster for hover detection
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Create info panel HTML element
    createInfoPanel();

    // Add event listeners
    const canvas = renderer.domElement;
    if (!isMobile) {
        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mouseleave', hideInfoPanel);
    } else {
        // Use touch events for mobile
        canvas.addEventListener('touchstart', onTouchStart, { passive: false }); // Need passive false for preventDefault
        // touchmove and touchend are added dynamically in onTouchStart
    }

    // Expose handlers globally for other modules
    window.plotHoverHandlers = {
        onTouchStart: onTouchStart, // Expose touch start handler if needed elsewhere
        hideInfoPanel: hidePlotInfoPanel // Expose function to hide panel externally
    };

    // Start checking for plot hovers (will work for both mouse and touch)
    checkPlotHovers();

    // Update mobile flag on resize
    window.addEventListener('resize', () => {
        const wasMobile = isMobile;
        isMobile = window.innerWidth <= 768;
        // If switching between mobile/desktop, re-attach listeners
        if (wasMobile !== isMobile) {
            removeEventListeners(renderer.domElement);
            attachEventListeners(renderer.domElement);
        }
    });
}

// Helper to attach event listeners based on mode
function attachEventListeners(canvas) {
    if (!isMobile) {
        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mouseleave', hideInfoPanel);
    } else {
        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    }
}

// Helper to remove event listeners
function removeEventListeners(canvas) {
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mouseleave', hideInfoPanel);
    canvas.removeEventListener('touchstart', onTouchStart);
    // Dynamically added listeners are removed in their respective handlers
    canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onTouchEnd);
}

// Create the info panel HTML element
function createInfoPanel() {
    infoPanel = document.createElement('div');
    infoPanel.className = 'plot-info-panel';
    infoPanel.style.display = 'none';
    document.body.appendChild(infoPanel);

    // Add the coin styles if not already added
    if (!document.querySelector('link[href="plotCoinStyles.css"]')) {
        const coinStyles = document.createElement('link');
        coinStyles.rel = 'stylesheet';
        coinStyles.href = 'plotCoinStyles.css';
        document.head.appendChild(coinStyles);
    }
}

// Handle mouse movement (desktop only)
function onMouseMove(event) {
    if (isMobile) return;

    // Calculate mouse position in normalized device coordinates
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();

    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Request check immediately on mouse move for responsiveness
    checkPlotHovers(event.clientX, event.clientY);
}

// Handle touch start (mobile only)
function onTouchStart(event) {
    if (!isMobile) return;

    // Clear any existing hide timeout
    if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
    }

    // Use the first touch point
    if (event.touches && event.touches.length > 0) {
        const touch = event.touches[0];

        // Store initial touch position
        touchStartPos.x = touch.clientX;
        touchStartPos.y = touch.clientY;
        isDragging = false; // Reset dragging flag

        // Prevent default scroll/zoom behavior only if not clicking on UI elements
        // This might need refinement depending on other UI elements
        if (event.cancelable) {
             event.preventDefault();
        }


        // Update mouse vector for raycasting
        const canvas = renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

        // Force an immediate check for plot intersection
        const intersected = checkPlotHovers(touch.clientX, touch.clientY);

        // If a plot was intersected, add move and end listeners
        if (intersected) {
            canvas.addEventListener('touchmove', onTouchMove, { passive: false });
            canvas.addEventListener('touchend', onTouchEnd, { once: true });
        }
    }
}

// Handle touch move (mobile only) - Added dynamically
function onTouchMove(event) {
    if (!isMobile || isDragging) return; // Only check if not already dragging

    if (event.touches && event.touches.length > 0) {
        const touch = event.touches[0];
        const deltaX = Math.abs(touch.clientX - touchStartPos.x);
        const deltaY = Math.abs(touch.clientY - touchStartPos.y);

        // If movement exceeds threshold, consider it a drag
        if (deltaX > dragThreshold || deltaY > dragThreshold) {
            isDragging = true;
            console.log("Dragging detected, hiding plot info panel.");
            hideInfoPanel(); // Hide panel immediately on drag
            // Listeners will be removed in hideInfoPanel
        }
    }
}


// Handle touch end (mobile only) - Added dynamically
function onTouchEnd(event) {
    const canvas = renderer.domElement;
    canvas.removeEventListener('touchmove', onTouchMove); // Clean up move listener

     // If not dragging, keep panel visible for a short time
     if (!isDragging) {
         touchTimeout = setTimeout(hideInfoPanel, 3000);
     } else {
         // If dragging occurred, the panel should already be hidden, but ensure timeout is clear
         if (touchTimeout) clearTimeout(touchTimeout);
         touchTimeout = null;
     }
     // Reset dragging flag for the next touch sequence
     isDragging = false;
}

// Global function to hide the panel externally
export function hidePlotInfoPanel() {
    if (isMobile && infoPanel && infoPanel.style.display !== 'none') {
        hideInfoPanel();
    }
}

// Hide the info panel
function hideInfoPanel() {
    if (!infoPanel) return; // Guard clause

    infoPanel.style.display = 'none';
    infoPanel.classList.remove('mobile-fixed'); // Remove fixed class

    // Reset any highlighted plots
    if (activePlotId) {
        const activePlot = findPlotObject(activePlotId);
        if (activePlot) resetPlotHighlight(activePlot);
    }
    activePlotId = null;

    // Clear the touch end timeout if it's still pending
    if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
    }

    // Remove dynamically added touch listeners
    if (isMobile && renderer) {
        const canvas = renderer.domElement;
        canvas.removeEventListener('touchmove', onTouchMove);
        // touchend listener is added with { once: true }, so it removes itself
    }
    console.log("Plot info panel hidden.");
}

// Show the info panel with plot data
function showInfoPanel(plot, clientX, clientY) {
    // Find the plot data by ID
    const plotData = cityData.lots.find(lot => lot.id === plot.userData.id);

    if (!plotData) return;

    // Calculate estimated construction time
    const minSeconds = plotData.price * 3;
    const maxSeconds = plotData.price * 7;
    const minTimeFormatted = formatTime(minSeconds);
    const maxTimeFormatted = formatTime(maxSeconds);

    // Get occupant info
    const occupants = plotData.occupants || [];
    const occupantCount = occupants.length;
    const maxCapacity = plotData.maxCapacity || 8;
    const isFull = occupantCount >= maxCapacity;
    const occupantLLMs = occupants.map(id => llmDataManager.getLLMById(id)).filter(llm => llm); // Get full LLM data for occupants

    // Determine status text and class
    let statusText = 'Available';
    let statusClass = 'available';
    if (!plotData.available || occupantCount > 0) {
        if (isFull) {
            statusText = `Full (${occupantCount}/${maxCapacity})`;
            statusClass = 'full';
        } else {
            statusText = `Occupied (${occupantCount}/${maxCapacity})`;
            statusClass = 'unavailable'; // Use 'unavailable' style (yellow) for occupied but not full
        }
    }

    // Build HTML content
    let htmlContent = `
        <div class="plot-info-header">${plotData.name}</div>
        <div class="plot-info-content">
            <div class="plot-info-row">
                <span class="plot-info-label">Size:</span>
                <span class="plot-info-value">${plotData.width}m × ${plotData.height}m</span>
            </div>
            <div class="plot-info-row">
                <span class="plot-info-label">Type:</span>
                <span class="plot-info-value">${capitalizeFirstLetter(plotData.type)}</span>
            </div>
            <div class="plot-info-row">
                <span class="plot-info-label">Credits:</span>
                <span class="plot-info-value websim-credits">${plotData.price} <img src="/websim-credit.png" class="credit-icon" alt="Credits"></span>
            </div>
            <div class="plot-info-row">
                <span class="plot-info-label">Est.:</span>
                <span class="plot-info-value">${minTimeFormatted} - ${maxTimeFormatted}</span>
            </div>
            <div class="plot-info-row">
                <span class="plot-info-label">Status:</span>
                <span class="plot-info-value ${statusClass}">
                    ${statusText}
                </span>
            </div>`;

    // Add requirements section for commercial plots
    if ((plotData.type === 'commercial' || plotData.type === 'residential') && plotData.requirements && plotData.requirements.length > 0) {
        htmlContent += `
            <div class="plot-info-requirements">
                <div class="requirements-title">Required Models:</div>
                <div class="requirements-icons">`;

        // Check which requirements are met by occupants
        const metRequirements = new Set();
        occupantLLMs.forEach(llm => {
            if (plotData.requirements.includes(llm.model)) {
                metRequirements.add(llm.model);
            }
        });

        // Add icons for each required model type
        plotData.requirements.forEach(modelType => {
            const isMet = metRequirements.has(modelType);
            htmlContent += `<div class="requirement-icon ${modelType} ${isMet ? 'requirement-met' : ''}" title="${capitalizeFirstLetter(modelType)}">
                ${getModelTypeIcon(modelType)}
            </div>`;
        });

        htmlContent += `
                </div>
            </div>`;
    }

    // Add description and close content div
    htmlContent += `
            <div class="plot-info-description">${plotData.description}</div>
        </div>`;

    // Update content
    infoPanel.innerHTML = htmlContent;

    // Show the panel and apply positioning
    infoPanel.style.display = 'block';
    if (isMobile) {
        // Apply fixed positioning class for mobile
        infoPanel.classList.add('mobile-fixed');
        // Reset inline styles that might interfere
        infoPanel.style.left = '';
        infoPanel.style.top = '';
    } else {
        // Follow cursor for desktop
        infoPanel.classList.remove('mobile-fixed');
        positionPanel(clientX, clientY); // Use helper for positioning
    }
}

// Helper to position the panel relative to the cursor, avoiding screen edges
function positionPanel(clientX, clientY) {
    const panelWidth = infoPanel.offsetWidth;
    const panelHeight = infoPanel.offsetHeight;
    const margin = 15; // Margin from cursor and screen edge

    let newLeft = clientX + margin;
    let newTop = clientY + margin;

    // Adjust if panel goes off right edge
    if (newLeft + panelWidth > window.innerWidth - margin) {
        newLeft = clientX - panelWidth - margin;
    }
    // Adjust if panel goes off bottom edge
    if (newTop + panelHeight > window.innerHeight - margin) {
        newTop = clientY - panelHeight - margin;
    }
    // Adjust if panel goes off left edge (after right edge adjustment)
    if (newLeft < margin) {
        newLeft = margin;
    }
    // Adjust if panel goes off top edge (after bottom edge adjustment)
    if (newTop < margin) {
        newTop = margin;
    }


    infoPanel.style.left = `${newLeft}px`;
    infoPanel.style.top = `${newTop}px`;
}

// Keep a reference to the animation frame request
let hoverCheckFrameId = null;

// Continuous check for plot hovers
function checkPlotHovers(clientX, clientY) {
    // Don't check hovers if drone is active, as it interferes with drone controls/UI
    if (window.droneActive) {
        // Ensure the panel is hidden if the drone becomes active while it's shown
        if (infoPanel && infoPanel.style.display !== 'none') {
             hideInfoPanel();
        }
        return false; // Skip hover checks during drone transport
    }

    // Cancel previous frame request if any
    if(hoverCheckFrameId) cancelAnimationFrame(hoverCheckFrameId);

    // Schedule the check for the next animation frame
    hoverCheckFrameId = requestAnimationFrame(() => {
        const intersected = _performHoverCheck(clientX, clientY);
        hoverCheckFrameId = null; // Reset ID after execution
        return intersected;
    });
}

// Renamed the internal checking logic
function _performHoverCheck(clientX, clientY) {
    // Double check drone status within the actual check logic too
    if (window.droneActive || !scene || !camera) return false; // Return false if no scene/camera or drone is active

    // Update the picking ray
    raycaster.setFromCamera(mouse, camera);

    // Find all plot objects in the scene
    const plotObjects = [];
    scene.traverse(obj => {
        // Only consider the main group of the plot outline for raycasting efficiency
        if (obj.userData && obj.userData.type === 'lot' && obj.name === 'plot_outline') {
            plotObjects.push(obj);
        }
    });

    // First try direct hits on the plot outlines (visual elements like tape, cones, poles)
    let intersects = raycaster.intersectObjects(plotObjects, true); // recursive check

    let foundIntersect = false;
    let intersectedPlot = null;

    if (intersects.length > 0) {
        // Find the actual plot parent object (plot_outline)
        let plot = intersects[0].object;
        while (plot && (!plot.userData || plot.userData.type !== 'lot')) {
            plot = plot.parent;
            if (!plot) break; // Safety check
        }

        if (plot && plot.userData && plot.userData.id) {
            foundIntersect = true;
            intersectedPlot = plot;
        }
    }

    // If no direct hit, check against bounding boxes (only if direct hit failed)
    if (!foundIntersect) {
        for (const plot of plotObjects) {
            if (!plot.userData.boundingBox) {
                const box = new THREE.Box3().setFromObject(plot);
                plot.userData.boundingBox = box;
            }
            const intersectPoint = new THREE.Vector3();
            if (raycaster.ray.intersectsBox(plot.userData.boundingBox, intersectPoint)) {
                foundIntersect = true;
                intersectedPlot = plot; // Use the plot_outline group
                break; // Only need one hit
            }
        }
    }


    if (foundIntersect && intersectedPlot) {
        // If we're hovering over a different plot, reset the previous one
        if (activePlotId && activePlotId !== intersectedPlot.userData.id) {
            const previousPlot = findPlotObject(activePlotId);
            if (previousPlot) resetPlotHighlight(previousPlot);
        }

        // Highlight the current plot only if it's not already active
        if (activePlotId !== intersectedPlot.userData.id) {
            highlightPlot(intersectedPlot);
        }

        // Show info panel (pass coordinates for positioning)
        showInfoPanel(intersectedPlot, clientX, clientY);

        // Store current active plot ID
        activePlotId = intersectedPlot.userData.id;
        return true; // Indicate that an intersection occurred
    } else {
        // If no valid intersections found this frame
        // Only hide if not mobile OR if mobile and not currently in touch timeout phase
        if (!isMobile || (isMobile && !touchTimeout)) {
             hideInfoPanel();
        }
        return false; // Indicate no intersection
    }
}

// Find a plot object by ID
function findPlotObject(id) {
    let foundPlot = null;
    scene.traverse(obj => {
        if (obj.userData && obj.userData.type === 'lot' && obj.userData.id === id) {
            foundPlot = obj;
        }
    });
    return foundPlot;
}

// Highlight a plot
function highlightPlot(plot) {
    // Find construction tape material
    plot.traverse(child => {
        if (child.isMesh) {
            // Store original material for reset only if not already highlighted
            if (!child.userData.originalMaterial) {
                child.userData.originalMaterial = child.material.clone();
            }

            // Highlight based on mesh type
            if (child.name && child.name.includes('tape')) {
                // Safely set emissive properties
                safeSetEmissive(child.material, 0xffff00);
            } else if (child.name && child.name.includes('cone')) {
                // Safely set emissive properties
                safeSetEmissive(child.material, 0xff5500, 0.5);
            } else if (child.name && child.name.includes('pole')) {
                // Safely set emissive properties
                safeSetEmissive(child.material, 0x8B4513, 0.2);
            }
        }
    });
}

// Reset plot highlight
function resetPlotHighlight(plot) {
    plot.traverse(child => {
        if (child.isMesh && child.userData.originalMaterial) {
            // Reset to original material properties safely
            const original = child.userData.originalMaterial;
            if (child.material.color && original.color) {
                child.material.color.copy(original.color);
            }
            if (child.material.emissive && original.emissive) {
                child.material.emissive.copy(original.emissive);
            }
            if (child.material.emissiveIntensity !== undefined && original.emissiveIntensity !== undefined) {
                child.material.emissiveIntensity = original.emissiveIntensity;
            }
             // Remove the stored original material reference after resetting
             delete child.userData.originalMaterial;
        }
    });
}

// Format seconds into a more readable time format
function formatTime(seconds) {
    if (seconds < 60) {
        return `${seconds}s`;
    } else if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return mins > 0 ? `${hours}hr ${mins}m` : `${hours}hr`;
    }
}

// Helper function to get model type icon SVG
function getModelTypeIcon(modelType) {
    switch(modelType) {
        case 'assistant':
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M19 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h4l3 3 3-3h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 16h-4.83l-1.17 1.17-1.17-1.17H5V4h14v14z"/>
                <path d="M11 15h2v2h-2zm0-8h2v6h-2z"/>
            </svg>`;
        case 'creator':
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37l-1.34-1.34a.996.996 0 0 0-1.41 0L9 12.25 11.75 15l8.96-8.96a.996.996 0 0 0 0-1.41z"/>
            </svg>`;
        case 'researcher':
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M9.5 16c-1.93 0-3.5-1.57-3.5-3.5S7.57 9 9.5 9s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5zm5.5-1l5 5-1.5 1.5-5-5V15l-0.03-0.03c-1.45 1.28-3.36 2.03-5.47 2.03-4.56 0-8.25-3.69-8.25-8.25s3.69-8.25 8.25-8.25S17 4.19 17 8.75c0 2.11-0.76 4.02-2.05 5.47L15 14.24z"/>
            </svg>`;
        case 'companion':
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-.29.02-.58.05-.86 2.36-1.05 4.23-2.98 5.21-5.37C11.07 8.33 14.05 10 17.42 10c.78 0 1.53-.09 2.25-.26.21.71.33 1.47.33 2.26 0 4.41-3.59 8-8 8z"/>
            </svg>`;
        case 'humanoid':
            // Updated Humanoid icon to be more distinct
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M12,2C9.8,2,8,3.8,8,6c0,1.1,0.4,2.1,1.2,2.8C7.3,9.5,6,11.4,6,13.5V16c0,1.1,0.9,2,2,2h1v3c0,0.6,0.4,1,1,1h6c0.6,0,1-0.4,1-1v-3h1c1.1,0,2-0.9,2-2v-2.5c0-2.1-1.3-4-3.2-4.7C17.6,8.1,18,7.1,18,6C18,3.8,16.2,2,14,2H12z M12,4h2c1.1,0,2,0.9,2,2s-0.9,2-2,2h-2C10.9,8,10,7.1,10,6S10.9,4,12,4z M9,13.5c0-1.4,1.1-2.5,2.5-2.5h3c1.4,0,2.5,1.1,2.5,2.5V16H9V13.5z"/>
            </svg>`;
        default:
            return '';
    }
}

// Helper to capitalize first letter
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}