import * as THREE from 'three';
import { renderLLMCharacter } from './llmCharacterRenderer.js';

// State for carousel
let carouselLLMs = [];
let currentIndex = 0;
let llmModels = [];
let scene, camera, renderer, animationId;
let leftArrow, rightArrow;
let selectedModelId = null; // Track selected model ID

export function setupLLMCarousel(viewportElement, llms) {
    // Store LLMs and reset index
    carouselLLMs = [...llms];
    currentIndex = 0;
    selectedModelId = null; // Reset selection when carousel initializes
    
    // Clear existing content and models
    viewportElement.innerHTML = '';
    llmModels = [];
    
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    
    // Only proceed if we have LLMs to display
    if (carouselLLMs.length === 0) {
        displayEmptyState(viewportElement);
        return;
    }
    
    // Initialize Three.js scene
    initCarouselScene(viewportElement);
    
    // Add navigation arrows
    addNavigationArrows(viewportElement);
    
    // Load initial models
    updateCarouselModels();
    
    // Start animation
    animateCarousel();
    
    // Select first LLM by default
    if (carouselLLMs.length > 0) {
        selectModel(carouselLLMs[0].id);
    }
}

function initCarouselScene(viewportElement) {
    try {
        // Setup Three.js scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x111111);
        
        // Setup camera
        camera = new THREE.PerspectiveCamera(
            45, 
            viewportElement.clientWidth / viewportElement.clientHeight, 
            0.1, 
            1000
        );
        camera.position.set(0, 2, 7);
        camera.lookAt(0, 1, 0);
        
        // Setup renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(viewportElement.clientWidth, viewportElement.clientHeight);
        renderer.shadowMap.enabled = true;
        viewportElement.appendChild(renderer.domElement);
        
        // Explicitly set renderer size based on parent
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        
        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(2, 5, 3);
        directionalLight.castShadow = true;
        scene.add(directionalLight);
        
        // Add floor
        const floorGeometry = new THREE.PlaneGeometry(20, 20);
        const floorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x222222,
            roughness: 0.8,
            metalness: 0.2
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        floor.position.y = -1;
        scene.add(floor);
        
        // Handle window resize
        window.addEventListener('resize', () => {
            if (camera && renderer && viewportElement) {
                camera.aspect = viewportElement.clientWidth / viewportElement.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(viewportElement.clientWidth, viewportElement.clientHeight);
            }
        });
    } catch (error) {
        console.error('Error initializing carousel scene:', error);
    }
}

function addNavigationArrows(viewportElement) {
    // Create left arrow
    leftArrow = document.createElement('button');
    leftArrow.className = 'carousel-arrow left-arrow';
    leftArrow.innerHTML = '&lt;';
    leftArrow.addEventListener('click', navigateLeft);
    viewportElement.appendChild(leftArrow);
    
    // Create right arrow
    rightArrow = document.createElement('button');
    rightArrow.className = 'carousel-arrow right-arrow';
    rightArrow.innerHTML = '&gt;';
    rightArrow.addEventListener('click', navigateRight);
    viewportElement.appendChild(rightArrow);
    
    // Update arrow visibility
    updateArrowVisibility();
}

function navigateLeft() {
    if (currentIndex > 0) {
        currentIndex--;
        updateCarouselModels();
        updateArrowVisibility();
        
        // Select the model at the new current index
        if (carouselLLMs[currentIndex]) {
            selectModel(carouselLLMs[currentIndex].id);
        }
    }
}

function navigateRight() {
    if (currentIndex < carouselLLMs.length - 1) {
        currentIndex++;
        updateCarouselModels();
        updateArrowVisibility();
        
        // Select the model at the new current index
        if (carouselLLMs[currentIndex]) {
            selectModel(carouselLLMs[currentIndex].id);
        }
    }
}

function updateArrowVisibility() {
    // Show/hide arrows based on position in carousel
    if (leftArrow && rightArrow) {
        leftArrow.style.opacity = currentIndex > 0 ? "1" : "0.3";
        rightArrow.style.opacity = currentIndex < carouselLLMs.length - 1 ? "1" : "0.3";
    }
}

function updateCarouselModels() {
    // Remove existing models
    llmModels.forEach(model => {
        if (model && model.parent) {
            model.parent.remove(model);
        }
    });
    llmModels = [];
    
    // Determine which LLMs to display (current, previous, next)
    const displayIndices = [];
    displayIndices.push(currentIndex);
    
    if (currentIndex > 0) {
        displayIndices.unshift(currentIndex - 1);
    }
    
    if (currentIndex < carouselLLMs.length - 1) {
        displayIndices.push(currentIndex + 1);
    }
    
    // Create and position models
    displayIndices.forEach((index, i) => {
        const llm = carouselLLMs[index];
        
        const position = calculatePosition(index - currentIndex);
        
        try {
            const model = renderLLMCharacter(THREE, llm);
            
            model.position.set(position.x, position.y, position.z);
            model.rotation.y = position.rotation;
            model.userData = { id: llm.id, index: index };
            
            // Add a selection indicator if this model is selected
            if (llm.id === selectedModelId) {
                addSelectionIndicator(model);
            }
            
            scene.add(model);
            llmModels.push(model);
        } catch (error) {
            console.error('Error creating model for LLM:', llm.name, error);
        }
    });
}

function calculatePosition(offset) {
    // Calculate position based on offset from center
    const x = offset * 3; // Horizontal spacing
    const z = Math.abs(offset) * 2; // Push off-center models back
    const y = 0;
    const rotation = -offset * 0.3; // Turn model slightly toward camera
    
    return { x, y, z, rotation };
}

function displayEmptyState(viewportElement) {
    // Display a message when no LLMs are available
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-carousel';
    emptyMessage.innerHTML = `
        <p>No LLMs have been created yet.</p>
        <p>Create your first LLM to see it here!</p>
    `;
    viewportElement.appendChild(emptyMessage);
}

function addSelectionIndicator(model) {
    // Remove any existing selection indicators first
    clearVisualSelection();
    
    // Create a ring around the model
    const ringGeometry = new THREE.RingGeometry(1.5, 1.7, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x3cb371,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2; // Flat on the ground
    ring.position.y = -0.99; // Fixed position just above ground level
    ring.userData.isSelectionRing = true;
    ring.name = "selectionRing";
    
    // IMPORTANT: Store the model ID with the ring for identification
    ring.userData.modelId = model.userData.id;
    
    // Set position to match the model
    ring.position.x = model.position.x;
    ring.position.z = model.position.z;
    
    // Add to scene
    scene.add(ring);
    
    // Add a highlight effect
    const highlight = new THREE.PointLight(0x3cb371, 1, 3);
    highlight.position.set(0, 1, 0);
    highlight.userData.isSelectionHighlight = true;
    highlight.name = "selectionHighlight";
    model.add(highlight);
    
    // Add another light from below for more dramatic effect
    const bottomLight = new THREE.PointLight(0x3cb371, 0.5, 2);
    bottomLight.position.set(0, -0.5, 0);
    bottomLight.userData.isSelectionHighlight = true;
    bottomLight.name = "bottomHighlight";
    model.add(bottomLight);
    
    // Store a reference to the selection indicators
    model.userData.selectionIndicators = [ring, highlight, bottomLight];
    model.userData.selectionRing = ring; // Store direct reference to ring
}

// Function to clear only visual selection indicators
function clearVisualSelection() {
    if (!scene) return; // Guard clause if scene is not initialized

    const selectionRings = [];
    scene.children.forEach(child => {
        if (child.userData && child.userData.isSelectionRing) {
            selectionRings.push(child);
        }
    });
    selectionRings.forEach(ring => scene.remove(ring));

    llmModels.forEach(model => {
        if (model && model.userData.selectionIndicators) {
            model.userData.selectionIndicators.forEach(indicator => {
                if (indicator.parent === model) model.remove(indicator);
            });
            delete model.userData.selectionIndicators;
            delete model.userData.selectionRing;
        }
    });
}

// Function to select a model by ID
export function selectModel(id) {
    if (!id) {
        console.warn("Attempted to select model with invalid ID:", id);
        return;
    }
    // Don't proceed if already selected
    if (id === selectedModelId) {
        console.log(`Model ${id} already selected.`);
        return;
    }

    console.log(`Attempting to select model ID: ${id}`);

    // Clear previous visual selection indicators
    clearVisualSelection();

    // Update the selected ID *now*
    selectedModelId = id;
    console.log(`Selected model ID set to: ${selectedModelId}`);

    // Find the model in the current view to add indicators
    const selectedModel = llmModels.find(model => model.userData.id === id);
    if (selectedModel) {
        addSelectionIndicator(selectedModel); // Add new indicators

        // Pan to the selected model if it's not the current one
        const llmIndex = carouselLLMs.findIndex(llm => llm.id === id);
        if (llmIndex !== -1 && llmIndex !== currentIndex) {
             currentIndex = llmIndex;
             updateCarouselModels(); // This will re-render models and implicitly add indicator via updateCarouselModels calling addSelectionIndicator if needed
             updateArrowVisibility();
        }
    } else {
         console.warn(`Model with ID ${id} not found in current carousel view. Selection ID set, but no visual indicator added.`);
         // If the model isn't visible (e.g., large collection), still update the list
    }

    // Update list view highlighting regardless of visual presence
    updateListSelection(id);
}

// Update the list view to highlight selected item
function updateListSelection(id) {
    // Remove previous highlights
    document.querySelectorAll('.llm-list-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Add highlight to selected item
    const selectedItem = document.querySelector(`.llm-list-item[data-id="${id}"]`);
    if (selectedItem) {
        selectedItem.classList.add('selected');
    }
    
    // If selection happened via list, ensure carousel visuals update if needed
    const modelToSelect = llmModels.find(model => model.userData.id === id);
    if (modelToSelect && !modelToSelect.userData.selectionRing) { // Check if already visually selected
        clearVisualSelection(); // Clear any other visual selection
        addSelectionIndicator(modelToSelect); // Apply visual selection
    }
}

// Get the ID of the currently selected model
export function getSelectedModelId() {
    console.log("Getting selected model ID:", selectedModelId); // Add log
    return selectedModelId;
}

function animateCarousel() {
    if (!scene || !camera || !renderer) {
        console.error('Cannot animate: scene, camera, or renderer is missing');
        return;
    }
    
    // Make references available globally for the raycaster
    window.carouselScene = scene;
    window.carouselCamera = camera;
    
    animationId = requestAnimationFrame(animateCarousel);
    
    llmModels.forEach((model, index) => {
        if (!model) return;
        
        const time = Date.now() * 0.001;
        const offset = index * 0.5;
        
        // Simple hover effect - only apply to the model, not its children directly
        const originY = calculatePosition(model.userData.index - currentIndex).y;
        model.position.y = originY + Math.sin(time + offset) * 0.1;
        
        // Subtle rotation
        const baseRotation = calculatePosition(model.userData.index - currentIndex).rotation;
        model.rotation.y = baseRotation + Math.sin(time * 0.5 + offset) * 0.1;
        
        // Find the selection ring for this model and update its position
        scene.children.forEach(child => {
            if (child.userData && 
                child.userData.isSelectionRing && 
                child.userData.modelId === model.userData.id) {
                // Keep ring at fixed height and update x,z position
                child.position.x = model.position.x;
                child.position.z = model.position.z;
                
                // Pulse the ring size slightly
                const pulseFactor = 1 + Math.sin(time * 2) * 0.05;
                child.scale.x = child.scale.z = pulseFactor;
            }
        });
        
        // Update other lights/effects on the model
        if (model.userData.selectionIndicators) {
            model.userData.selectionIndicators.forEach(indicator => {
                if (indicator.userData && indicator.userData.isSelectionHighlight) {
                    // Pulse the light intensity
                    indicator.intensity = 1 + Math.sin(time * 2) * 0.3;
                }
            });
        }
    });

    renderer.render(scene, camera);
}

export function cleanupCarousel() {
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    
    // Clean up all models and selection indicators
    if (scene) {
        clearVisualSelection(); // Use the visual clearing function
        
        // Clean up models
        llmModels.forEach(model => {
            if (model && model.parent) {
                model.parent.remove(model);
            }
        });
    }
    
    llmModels = [];
    scene = null;
    camera = null;
    renderer = null;
    selectedModelId = null; // Reset selection ID *only* when cleaning up the entire carousel
    console.log("Carousel cleaned up, selectedModelId reset."); // Add log
}