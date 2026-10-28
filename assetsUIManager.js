// Assets UI Management
import { hidePlotInfoPanel } from './plotHoverInfo.js';
import { playTrack } from './musicPlayer.js';
import { showConfirmationModal } from './confirmationModal.js';
import { deactivateDroneTransport } from './llmDroneTransport.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; // Import GLTFLoader

// Sample asset categories and data
const assetCategories = [
    { id: 'all', name: 'All Assets' },
    { id: 'buildings', name: 'Buildings' },
    { id: 'characters', name: 'Characters' },
    { id: 'vehicles', name: 'Vehicles' },
    { id: 'furniture', name: 'Furniture' },
    { id: 'decorations', name: 'Decorations' },
    { id: 'nature', name: 'Nature' },
    { id: 'textures', name: 'Textures' }
];

// Sample assets with mock data
const sampleAssets = [
    { id: 1, name: 'Modern House', category: 'buildings', image: '' },
    { id: 2, name: 'Office Building', category: 'buildings', image: '' },
    { id: 3, name: 'Robot Character', category: 'characters', image: '', isDefaultRobot: true },
    { id: 4, name: 'Transport Drone', category: 'vehicles', image: '', isDrone: true },
    { id: 5, name: 'Car', category: 'vehicles', image: '' },
    { id: 6, name: 'Office Chair', category: 'furniture', image: '' },
    { id: 7, name: 'Desk', category: 'furniture', image: '' },
    { id: 8, name: 'Lamp', category: 'furniture', image: '' },
    { id: 9, name: 'Painting', category: 'decorations', image: '' },
    { id: 10, name: 'Plant', category: 'nature', image: '' },
    // Updated Tree asset with high/low detail paths (Ensure correct absolute paths)
    {
        id: 11,
        name: 'Pine Tree',
        category: 'nature',
        image: '',
        modelPathHigh: '/pine_tree_high.glb', // Correct absolute path
        modelPathLow: '/pine_tree_low.glb'   // Correct absolute path
    },
    { id: 12, name: 'Brick Wall', category: 'textures', image: '' },
    { id: 13, name: 'Wood Floor', category: 'textures', image: '' },
    { id: 14, name: 'Metal Panel', category: 'textures', image: '' },
    { id: 15, name: 'Fabric Pattern', category: 'textures', image: '' }
];

// GLTF Loader instance
const loader = new GLTFLoader();

// Store references to active renderers and animation frames for cleanup
let activeRenderers = {};

// Setup the Assets UI
export function setupAssetsUI() {
    console.log('Setting up Assets UI');
    hidePlotInfoPanel();
    cleanupAssetPreviews(); // Clean up any previous previews

    const assetsPanel = document.getElementById('assets-ui-panel');
    if (!assetsPanel) {
        createAssetsUIElements();
        // After creating elements, call setup again
        setupAssetsUI();
        return;
    }

    // Show the panel
    assetsPanel.classList.add('active');

    // Populate the UI
    populateCategorySidebar();
    populateAssetGrid('all');

    // Set up event listeners
    setupAssetsEventListeners();
}

// Create the UI elements for the Assets panel
function createAssetsUIElements() {
    const assetsPanel = document.createElement('div');
    assetsPanel.id = 'assets-ui-panel';
    assetsPanel.className = 'assets-ui-panel';

    assetsPanel.innerHTML = `
        <div class="assets-header">
            <div class="assets-title">Asset Library</div>
            <button class="assets-close">&times;</button>
        </div>

        <div class="assets-container">
            <div class="assets-sidebar">
                <div class="asset-category">
                    <div class="category-title">Categories</div>
                    <div class="category-items" id="category-list">
                        <!-- Categories will be added here -->
                    </div>
                </div>
            </div>

            <div class="assets-main">
                <div class="assets-filter">
                    <div class="search-container">
                        <div class="search-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                            </svg>
                        </div>
                        <input type="text" class="search-input" placeholder="Search assets...">
                    </div>

                    <select class="sort-select">
                        <option value="name-asc">Name (A-Z)</option>
                        <option value="name-desc">Name (Z-A)</option>
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                    </select>
                </div>

                <div class="assets-grid" id="assets-grid">
                    <!-- Assets will be added here -->
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(assetsPanel);
}

// Populate the category sidebar
function populateCategorySidebar() {
    const categoryList = document.getElementById('category-list');
    if (!categoryList) return;

    categoryList.innerHTML = '';

    assetCategories.forEach(category => {
        const categoryItem = document.createElement('div');
        categoryItem.className = 'category-item';
        categoryItem.dataset.id = category.id;
        categoryItem.innerHTML = `
            <div class="asset-category-icon">
                ${getIconForCategory(category.id)}
            </div>
            ${category.name}
        `;

        if (category.id === 'all') {
            categoryItem.classList.add('active');
        }

        categoryItem.addEventListener('click', () => {
            // Remove active class from all categories
            document.querySelectorAll('.category-item').forEach(item => {
                item.classList.remove('active');
            });

            // Add active class to clicked category
            categoryItem.classList.add('active');

            // Filter assets by category
            populateAssetGrid(category.id);
        });

        categoryList.appendChild(categoryItem);
    });
}

// Update the function to render a single asset item for the asset grid
function createAssetItemElement(asset) {
    const assetItem = document.createElement('div');
    assetItem.className = 'asset-item';
    assetItem.dataset.id = asset.id;
    assetItem.dataset.currentDetail = 'high'; // Default to high detail

    // Determine content based on asset type
    let imageContent = '';
    let canvasClass = '';
    let detailToggle = ''; // Placeholder for the LD/HD toggle button
    let hasPreview = false; // Flag to indicate if this asset has a 3D preview

    if (asset.isDefaultRobot || asset.isDrone || asset.modelPathHigh || asset.modelPathLow) {
        hasPreview = true; // Mark assets with 3D previews
        canvasClass = `preview-canvas-${asset.id}`;
        imageContent = `<canvas class="${canvasClass}" width="180" height="180"></canvas>`;

        // Schedule initial rendering AFTER element is added to DOM
        // These functions will now only render the first frame and store context
        if (asset.isDefaultRobot) {
            setTimeout(() => renderDefaultRobotPreview(assetItem.querySelector(`.${canvasClass}`), true), 50); // Pass true for initial render
        } else if (asset.isDrone) {
            setTimeout(() => renderDronePreview(assetItem.querySelector(`.${canvasClass}`), true), 50); // Pass true for initial render
        } else { // GLTF model
            const initialModelPath = asset.modelPathHigh || asset.modelPathLow;
            if (initialModelPath) {
                // Pass true for initialRender to prevent immediate animation
                setTimeout(() => renderGLTFPreview(assetItem.querySelector(`.${canvasClass}`), initialModelPath, asset.id, true), 50);
            } else {
                console.warn(`Asset ${asset.id} (${asset.name}) has no model path defined.`);
                imageContent = `<div style="background-color: #555; color: #f00; padding: 5px; text-align:center;">Missing Model</div>`;
                hasPreview = false; // No path, no preview
            }
        }

        // Add LD/HD toggle button if both paths exist
        if (asset.modelPathHigh && asset.modelPathLow) {
            detailToggle = `
                <button class="asset-detail-toggle" data-asset-id="${asset.id}" title="Toggle Detail Level">HD</button>
            `;
        }
    } else if (asset.category === 'textures') { // Handle textures
        // Simple placeholder for textures
        imageContent = `<div style="background-color: #555; display: flex; justify-content: center; align-items: center; width: 100%; height: 100%; font-size: 0.8em; color: #ccc;">
            Texture
        </div>`;
    } else {
        // Use icon for other assets
        imageContent = `<div style="background-color: #444; display: flex; justify-content: center; align-items: center; width: 100%; height: 100%;">
            ${getIconForCategory(asset.category)}
        </div>`;
    }

    assetItem.innerHTML = `
        <div class="asset-image-container">
            <div class="asset-header">
                <div class="asset-category-icon">${getIconForCategory(asset.category)}</div>
            </div>
            <div class="asset-image">
                ${imageContent}
            </div>
            ${detailToggle}
        </div>
        <div class="asset-info">
            <h3 class="asset-name">${asset.name}</h3>
        </div>
        <div class="asset-actions">
            <button class="asset-action-btn" title="Place in world">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
            </button>
        </div>
    `;

    // --- Add hover listeners ONLY for items with 3D previews ---
    if (hasPreview) {
        assetItem.addEventListener('mouseenter', handleAssetMouseEnter);
        assetItem.addEventListener('mouseleave', handleAssetMouseLeave);
    }
    // --- End hover listeners ---

    // Add click event for the asset item itself (selection)
    assetItem.addEventListener('click', (e) => {
        // Prevent selection if clicking the detail toggle button
        if (e.target.closest('.asset-detail-toggle')) {
            return;
        }
        // Select the asset
        document.querySelectorAll('.asset-item').forEach(item => {
            item.classList.remove('selected');
        });
        assetItem.classList.add('selected');
    });

    // Add click event for the detail toggle button AFTER innerHTML is set
    const toggleButton = assetItem.querySelector('.asset-detail-toggle');
    if (toggleButton) {
        toggleButton.removeEventListener('click', handleDetailToggle); // Remove previous listener
        toggleButton.addEventListener('click', handleDetailToggle);
    }

    return assetItem;
}

// --- Mouse Enter/Leave Handlers ---
function handleAssetMouseEnter(event) {
    const assetItem = event.currentTarget;
    const assetId = assetItem.dataset.id;
    if (!assetId || !activeRenderers[assetId]) return;

    const previewData = activeRenderers[assetId];

    // Start animation only if it's not already running
    if (previewData.animate && !previewData.animationFrameId) {
        console.log(`Starting animation for asset ${assetId}`);
        previewData.animate(); // Call the stored animate function to start the loop
    }
}

function handleAssetMouseLeave(event) {
    const assetItem = event.currentTarget;
    const assetId = assetItem.dataset.id;
    if (!assetId || !activeRenderers[assetId]) return;

    const previewData = activeRenderers[assetId];

    // Stop animation if it's running
    if (previewData.animationFrameId) {
        console.log(`Stopping animation for asset ${assetId}`);
        cancelAnimationFrame(previewData.animationFrameId);
        previewData.animationFrameId = null; // Reset the ID
    }
}
// --- End Mouse Enter/Leave Handlers ---


// --- Preview Rendering Functions ---

// Function to render a default robot preview
function renderDefaultRobotPreview(canvas, initialRender = false) {
    if (!canvas) return;
    const assetId = canvas.closest('.asset-item')?.dataset.id;
    if (!assetId) return;

    const { scene, camera, renderer } = setupPreviewEnvironment(canvas, assetId);
    import('./llmModelCreationRenderer.js').then(module => {
        const robotModel = module.createRobotModel(scene, '#3cb371', 'modern').model;
        robotModel.position.y = -0.8; // Adjust Y position for preview
        robotModel.rotation.y = -Math.PI / 6; // Rotate slightly
        const previewData = activeRenderers[assetId];
        if (!previewData) return; // Environment might have been cleaned up
        previewData.model = robotModel; // Store model reference

        // Store the animate function reference but don't start loop yet if initialRender
        previewData.animate = () => {
            const currentPreviewData = activeRenderers[assetId]; // Get current data inside loop
            if (!currentPreviewData) return; // Stop if cleaned up
            robotModel.rotation.y += 0.01;
            currentPreviewData.renderer.render(currentPreviewData.scene, currentPreviewData.camera);
            currentPreviewData.animationFrameId = requestAnimationFrame(currentPreviewData.animate); // Store new frame ID
        };

        // Render first frame immediately
        renderer.render(scene, camera);

        if (!initialRender) {
            // If not initial render (e.g., detail toggle), start animation
            // *only if the mouse is currently over the element*
            const assetItem = canvas.closest('.asset-item');
            if (assetItem && assetItem.matches(':hover')) {
                 previewData.animate();
            }
        }

    }).catch(err => console.error("Error loading robot model for preview:", err));
}

// New function to create just the drone model for preview
function createDronePreviewModel(THREE) {
    const droneModel = new THREE.Group();
    droneModel.name = "DronePreviewModel";

    const DRONE_BASE_COLOR = 0xffffff;
    const DRONE_ACCENT_COLOR = 0xcccccc;
    const DRONE_DARK_ACCENT_COLOR = 0x888888;

    const bodyMaterial = new THREE.MeshStandardMaterial({ color: DRONE_BASE_COLOR, metalness: 0.6, roughness: 0.4 });
    const armMaterial = new THREE.MeshStandardMaterial({ color: DRONE_ACCENT_COLOR, metalness: 0.5, roughness: 0.5 });
    const propellerHubMaterial = new THREE.MeshStandardMaterial({ color: DRONE_DARK_ACCENT_COLOR, metalness: 0.8, roughness: 0.2 });
    const propellerBladeMaterial = new THREE.MeshStandardMaterial({ color: DRONE_ACCENT_COLOR, metalness: 0.4, roughness: 0.6, side: THREE.DoubleSide });

    const centralBodyRadius = 0.3;
    const centralBodyHeight = 0.2;
    const centralBody = new THREE.Mesh(
        new THREE.CylinderGeometry(centralBodyRadius * 0.8, centralBodyRadius, centralBodyHeight, 12),
        bodyMaterial
    );
    droneModel.add(centralBody);

    const propDistance = 1.0;
    const armWidth = 0.08;
    const armHeight = 0.08;
    const armLength = propDistance;
    const angleRad = Math.PI / 4;

    const propellerPositions = [
        { x: propDistance * Math.sin(angleRad), z: -propDistance * Math.cos(angleRad) },
        { x: -propDistance * Math.sin(angleRad), z: -propDistance * Math.cos(angleRad) },
        { x: -propDistance * Math.sin(angleRad), z: propDistance * Math.cos(angleRad) },
        { x: propDistance * Math.sin(angleRad), z: propDistance * Math.cos(angleRad) }
    ];

    propellerPositions.forEach((propPos) => {
        const armRotationY = Math.atan2(propPos.x, propPos.z);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(armWidth, armHeight, armLength), armMaterial);
        arm.position.set(propPos.x / 2, 0, propPos.z / 2);
        arm.rotation.y = armRotationY;
        droneModel.add(arm);

        const propeller = createPreviewPropeller(THREE, propellerHubMaterial, propellerBladeMaterial);
        propeller.position.set(propPos.x, armHeight / 2 + 0.05, propPos.z);
        droneModel.add(propeller);
    });

    return droneModel;
}

// Helper to create propeller for preview drone
function createPreviewPropeller(THREE, hubMaterial, bladeMaterial) {
    const propellerGroup = new THREE.Group();
    propellerGroup.name = "Propeller";

    const hubRadius = 0.1;
    const hubHeight = 0.08;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(hubRadius, hubRadius, hubHeight, 8), hubMaterial);
    propellerGroup.add(hub);

    const blades = new THREE.Group();
    blades.name = "Blades";
    propellerGroup.add(blades);

    const bladeLength = 0.6;
    const bladeWidth = 0.1;
    const bladeThickness = 0.01;
    const bladeGeometry = new THREE.BoxGeometry(bladeLength, bladeThickness, bladeWidth);

    const blade1 = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blades.add(blade1);
    const blade2 = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade2.rotation.y = Math.PI / 2;
    blades.add(blade2);

    blades.position.y = hubHeight / 2 + bladeThickness / 2;

    return propellerGroup;
}

// New function to render the drone preview
function renderDronePreview(canvas, initialRender = false) {
    if (!canvas) return;
    const assetId = canvas.closest('.asset-item')?.dataset.id;
    if (!assetId) return;

    const { scene, camera, renderer } = setupPreviewEnvironment(canvas, assetId, { cameraPos: new THREE.Vector3(0, 1.5, 4.5), lookAt: new THREE.Vector3(0, 0.2, 0) });

    const droneModel = createDronePreviewModel(THREE);
    droneModel.position.y = 0.3;
    droneModel.rotation.y = -Math.PI / 6;
    scene.add(droneModel);
    const previewData = activeRenderers[assetId];
    if (!previewData) return;
    previewData.model = droneModel;

    // Store animate function reference
    previewData.animate = () => {
        const currentPreviewData = activeRenderers[assetId]; // Get current data inside loop
        if (!currentPreviewData) return; // Stop if cleaned up
        droneModel.rotation.y += 0.01;
        // Animate propellers
        droneModel.traverse(child => {
            if (child.name === "Blades") {
                 child.rotation.y += 0.3;
            }
        });
        currentPreviewData.renderer.render(currentPreviewData.scene, currentPreviewData.camera); // Use stored renderer/scene/camera
        currentPreviewData.animationFrameId = requestAnimationFrame(currentPreviewData.animate); // Store new frame ID
    };

    // Render first frame immediately
    renderer.render(scene, camera);

    if (!initialRender) {
        // If not initial render (e.g., detail toggle), start animation
        // *only if the mouse is currently over the element*
        const assetItem = canvas.closest('.asset-item');
        if (assetItem && assetItem.matches(':hover')) {
             previewData.animate();
        }
    }
}

// Generic setup for preview scene, camera, renderer, lights
function setupPreviewEnvironment(canvas, assetId, options = {}) {
    // Clean up previous renderer for this asset ID if it exists
    cleanupPreview(assetId);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x333333);

    const camera = new THREE.PerspectiveCamera(40, canvas.width / canvas.height, 0.1, 100);
    camera.position.copy(options.cameraPos || new THREE.Vector3(0, 1, 3));
    camera.lookAt(options.lookAt || new THREE.Vector3(0, 0.5, 0));

    // Important: Make sure the renderer uses the provided canvas
    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true, // Keep alpha for transparency if needed
        preserveDrawingBuffer: true // Keep buffer for initial static frame
    });
    // Explicitly set the size again in case canvas dimensions changed
    renderer.setSize(canvas.width, canvas.height, false); // Set false to prevent style update

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(2, 3, 2);
    scene.add(directionalLight);

    // Store the newly created environment
    activeRenderers[assetId] = { scene, camera, renderer, animationFrameId: null, model: null, animate: null }; // Add animate property
    console.log(`Setup preview environment for asset ${assetId}`);

    return activeRenderers[assetId];
}

// Function to render a GLTF model preview
function renderGLTFPreview(canvas, modelPath, assetId, initialRender = false) {
    if (!canvas || !modelPath || !assetId) {
        console.error("Canvas, model path, or asset ID missing for GLTF preview.");
        return;
    }

    // Get the preview environment (cleans up previous if needed)
    const previewData = setupPreviewEnvironment(canvas, assetId);
    const { scene, camera, renderer } = previewData;

    console.log(`Loading GLTF model: ${modelPath} for asset ${assetId}`);

    loader.load(
        modelPath,
        (gltf) => {
            // Double check if the preview for this assetId still exists after async load
            const currentPreviewData = activeRenderers[assetId];
            if (!currentPreviewData) {
                console.log(`Preview for asset ${assetId} cleaned up before model loaded.`);
                return;
            }

            const model = gltf.scene;

            // --- Model centering and scaling logic ---
            model.updateMatrixWorld(); // Ensure matrix is updated
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            // Check for invalid bounding box
            if (!box.isEmpty() && size.length() > 0.001 && isFinite(size.length())) {
                const maxSize = Math.max(size.x, size.y, size.z);
                const desiredSize = 1.5; // Target size for the preview box
                const scale = desiredSize / maxSize;

                model.scale.set(scale, scale, scale);

                // Recalculate box after scaling
                model.updateMatrixWorld();
                const scaledBox = new THREE.Box3().setFromObject(model);
                const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

                 // Adjust position to center the model and place its bottom near y=0
                if(isFinite(scaledCenter.x) && isFinite(scaledBox.min.y) && isFinite(scaledCenter.z)) {
                    model.position.x -= scaledCenter.x;
                    model.position.y -= scaledBox.min.y; // Move bottom to y=0
                    model.position.y += 0.05; // Add slight offset above ground
                    model.position.z -= scaledCenter.z;
                } else {
                    console.warn(`Scaled center or min y is not finite for ${modelPath}. Using default position.`);
                    model.position.set(0, 0, 0); // Fallback position
                }


            } else {
                 console.warn(`Could not calculate valid bounding box for ${modelPath} (Size: ${size.length()}). Using default position/scale.`);
                 model.position.set(0, 0, 0);
                 model.scale.set(1, 1, 1);
            }
            // --- End centering logic ---

            scene.add(model);
            currentPreviewData.model = model; // Store model reference

            // Store animate function reference
            currentPreviewData.animate = () => {
                const framePreviewData = activeRenderers[assetId]; // Check again inside animation frame
                if (!framePreviewData) return;
                model.rotation.y += 0.01;
                framePreviewData.renderer.render(framePreviewData.scene, framePreviewData.camera);
                framePreviewData.animationFrameId = requestAnimationFrame(framePreviewData.animate);
            };

            // Render first frame immediately
            renderer.render(scene, camera);

            if (!initialRender) {
                // If not initial render (e.g., detail toggle), start animation
                // *only if the mouse is currently over the element*
                const assetItem = canvas.closest('.asset-item');
                if (assetItem && assetItem.matches(':hover')) {
                     currentPreviewData.animate();
                }
            }
        },
        undefined, // Progress callback (optional)
        (error) => {
            console.error(`Error loading GLTF model (${modelPath}):`, error);
             // More detailed error logging
             if (error.target && error.target.status) {
                 console.error(`Network error: Status ${error.target.status}`);
             }
             if (error.message) {
                 console.error(`Loader message: ${error.message}`);
             }
            // Display error in canvas
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#553333'; ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#ffaaaa'; ctx.font = '12px Arial'; ctx.textAlign = 'center';
                ctx.fillText('Load Error', canvas.width / 2, canvas.height / 2);
            }
            // Clean up renderer if load fails
             cleanupPreview(assetId); // Use the cleanup function
        }
    );
}

// --- End Preview Rendering Functions ---

// --- Detail Toggle Handler ---
function handleDetailToggle(event) {
    event.stopPropagation(); // Prevent asset selection

    const button = event.currentTarget;
    const assetId = button.dataset.assetId;
    const assetItem = button.closest('.asset-item');
    const canvas = assetItem.querySelector('canvas');

    if (!assetId || !assetItem || !canvas) return;

    const asset = sampleAssets.find(a => a.id == assetId);
    if (!asset || !asset.modelPathHigh || !asset.modelPathLow) return;

    const currentDetail = assetItem.dataset.currentDetail;
    const newDetail = currentDetail === 'high' ? 'low' : 'high';
    const modelPath = newDetail === 'high' ? asset.modelPathHigh : asset.modelPathLow;

    console.log(`Toggling detail for asset ${assetId} to ${newDetail}`);

    // Update button text
    button.textContent = newDetail === 'high' ? 'HD' : 'LD';
    assetItem.dataset.currentDetail = newDetail;

    // Determine if the item is currently hovered
    const isHovered = assetItem.matches(':hover');

    // Re-render the preview
    // Pass initialRender=true if not hovered, false if hovered
    renderGLTFPreview(canvas, modelPath, assetId, !isHovered);
}

// Populate the asset grid based on selected category
function populateAssetGrid(categoryId) {
    const assetsGrid = document.getElementById('assets-grid');
    if (!assetsGrid) return;

    // Cleanup previews before clearing grid
    cleanupAssetPreviews();
    assetsGrid.innerHTML = '';

    // Filter assets by category
    const filteredAssets = categoryId === 'all'
        ? sampleAssets
        : sampleAssets.filter(asset => asset.category === categoryId);

    if (filteredAssets.length === 0) {
        assetsGrid.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">No assets found in this category</div>';
        return;
    }

    filteredAssets.forEach(asset => {
        const assetItem = createAssetItemElement(asset);
        assetsGrid.appendChild(assetItem);
    });
}

// Get a placeholder icon based on asset category - updated character icon
function getIconForCategory(category) {
    switch(category) {
        case 'buildings':
            return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15 11V5l-3-3-3 3v2H3v14h18V11h-6zm-8 8H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5V9h2v2zm0-4H5V5h2v2zm6 12h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2zm6 12h-2v-2h2v2zm0-4h-2v-2h2v2z"/>
            </svg>`;
        case 'characters':
            return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                 <path d="M12,2C9.8,2,8,3.8,8,6c0,1.1,0.4,2.1,1.2,2.8C7.3,9.5,6,11.4,6,13.5V16c0,1.1,0.9,2,2,2h1v3c0,0.6,0.4,1,1,1h6c0.6,0,1-0.4,1-1v-3h1c1.1,0,2-0.9,2-2v-2.5c0-2.1-1.3-4-3.2-4.7C17.6,8.1,18,7.1,18,6C18,3.8,16.2,2,14,2H12z M12,4h2c1.1,0,2,0.9,2,2s-0.9,2-2,2h-2C10.9,8,10,7.1,10,6S10.9,4,12,4z M9,13.5c0-1.4,1.1-2.5,2.5-2.5h3c1.4,0,2.5,1.1,2.5,2.5V16H9V13.5z"/>
            </svg>`;
        case 'vehicles':
            return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
            </svg>`;
        case 'furniture':
            return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 8V6c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v2c-1.1 0-2 .9-2 2v10h20V10c0-1.1-.9-2-2-2zM6 6h12v2H6V6zm14 12H4v-3h2v1h12v-1h2v3z"/>
            </svg>`;
        case 'decorations':
            return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7z"/>
                <path d="M12 17l5-5h-3V8h-4v4H7z"/>
            </svg>`;
        case 'nature':
            return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 12h2L12 3 5 12h2v4H4v2h16v-2h-3v-4z"/>
            </svg>`;
        case 'textures':
            return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 3H3v18h18V3zm-2 16H5V5h14v14zm-5-6h-2v2H7v-2h2v-2h2v-2h2v2h2v2h2v2h-2z" opacity=".3"/>
                <path d="M5 3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H5zm14 16H5V5h14v14z"/>
                <path d="M7 15h2v-2H7v2zm4 0h2v-2h-2v2zm4 0h2v-2h-2v2zm-4-4h2V9h-2v2z"/>
            </svg>`;
        default:
            return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
                <path d="M18 9l-1.4-1.4-5.6 5.6-2.6-2.6L7 12l4 4z"/>
            </svg>`;
    }
}

// Set up event listeners for the Assets UI
function setupAssetsEventListeners() {
    // Close button
    const closeButton = document.querySelector('.assets-close');
    if (closeButton) {
        closeButton.removeEventListener('click', closeAssetsUI); // Remove previous listener if exists
        closeButton.addEventListener('click', closeAssetsUI);
    }

    // Search input
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.removeEventListener('input', handleSearchInput); // Remove previous listener if exists
        searchInput.addEventListener('input', handleSearchInput);
    }

    // Sort select
    const sortSelect = document.querySelector('.sort-select');
    if (sortSelect) {
        sortSelect.removeEventListener('change', handleSortChange); // Remove previous listener if exists
        sortSelect.addEventListener('change', handleSortChange);
    }
}

// Event handler for search input
function handleSearchInput(e) {
    const searchTerm = e.target.value.toLowerCase();
    filterAssetsBySearch(searchTerm);
}

// Event handler for sort select change
function handleSortChange(e) {
    sortAssets(e.target.value);
}

// Filter assets by search term
function filterAssetsBySearch(searchTerm) {
    // Get current active category
    const activeCategory = document.querySelector('.category-item.active');
    const categoryId = activeCategory ? activeCategory.dataset.id : 'all';

    // Filter assets by category and search term
    let filteredAssets = categoryId === 'all'
        ? sampleAssets
        : sampleAssets.filter(asset => asset.category === categoryId);

    // Further filter by search term
    if (searchTerm) {
        filteredAssets = filteredAssets.filter(asset =>
            asset.name.toLowerCase().includes(searchTerm)
        );
    }

    // Update the grid
    const assetsGrid = document.getElementById('assets-grid');
    if (!assetsGrid) return;

    cleanupAssetPreviews(); // Clean up previews before clearing
    assetsGrid.innerHTML = '';

    if (filteredAssets.length === 0) {
        assetsGrid.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">No assets match your search</div>';
        return;
    }

    // Repopulate with filtered assets
    filteredAssets.forEach(asset => {
        const assetItem = createAssetItemElement(asset);
        assetsGrid.appendChild(assetItem);
    });
}

// Sort assets by the selected option
function sortAssets(sortOption) {
    // Get current displayed assets
    const assetItems = Array.from(document.querySelectorAll('.asset-item'));
    const assetsGrid = document.getElementById('assets-grid');
    if (!assetsGrid || assetItems.length === 0) return;

    // Sort assets based on option
    assetItems.sort((a, b) => {
        const nameA = a.querySelector('.asset-name').textContent;
        const nameB = b.querySelector('.asset-name').textContent;

        switch(sortOption) {
            case 'name-asc':
                return nameA.localeCompare(nameB);
            case 'name-desc':
                return nameB.localeCompare(nameA);
            case 'newest':
                // Assuming higher ID means newer for now
                return parseInt(b.dataset.id) - parseInt(a.dataset.id);
            case 'oldest':
                return parseInt(a.dataset.id) - parseInt(b.dataset.id);
            default:
                return 0;
        }
    });

    // Clear and re-add sorted items
    cleanupAssetPreviews(); // Clean up previews before clearing
    assetsGrid.innerHTML = '';
    assetItems.forEach(item => {
        assetsGrid.appendChild(item);
    });
}

// Function to clean up a single preview renderer and animation frame
function cleanupPreview(assetId) {
    const previewData = activeRenderers[assetId];
    if (previewData) {
        console.log(`Cleaning up preview for asset ${assetId}`);
        if (previewData.animationFrameId) {
            cancelAnimationFrame(previewData.animationFrameId);
        }
        if (previewData.model && previewData.model.parent) {
             // Recursively dispose of geometry and materials in the model
             previewData.model.traverse(child => {
                 if (child.isMesh) {
                     if (child.geometry) child.geometry.dispose();
                     if (child.material) {
                         if (Array.isArray(child.material)) {
                             child.material.forEach(mat => mat.dispose());
                         } else {
                             child.material.dispose();
                         }
                     }
                 }
             });
            previewData.scene.remove(previewData.model);
        }
        if (previewData.renderer) {
            // Make sure context is not lost before disposing
             if (previewData.renderer.domElement.width > 0 && previewData.renderer.domElement.height > 0 && previewData.renderer.getContext() && !previewData.renderer.getContext().isContextLost()) {
                 previewData.renderer.dispose();
             } else {
                 console.warn(`WebGL context lost or invalid canvas size for renderer of asset ${assetId}. Cannot dispose properly.`);
             }
        }
        delete activeRenderers[assetId];
    }
}

// Function to clean up all active previews
function cleanupAssetPreviews() {
    console.log("Cleaning up all asset previews...");
    Object.keys(activeRenderers).forEach(assetId => {
        cleanupPreview(assetId);
    });
    activeRenderers = {}; // Reset the tracker
}

// Close the Assets UI
function closeAssetsUI() {
    const assetsPanel = document.getElementById('assets-ui-panel');
    if (assetsPanel) {
        assetsPanel.classList.remove('active');
    }
    cleanupAssetPreviews(); // Clean up previews when closing the UI
    playTrack('city');
}

// Export the openAssetsUI function for use in citySceneUI.js
export function openAssetsUI() {
    console.log('Opening Assets UI');
    hidePlotInfoPanel();

    if (window.droneActive) {
        showConfirmationModal(
            "Cancel drone transport to open the Assets UI?",
            () => {
                deactivateDroneTransport(true);
                playTrack('creation'); // Switch to creation music
                setupAssetsUI();
            },
            () => {
                console.log("Assets UI action cancelled due to active drone transport.");
            }
        );
    } else {
        playTrack('creation'); // Switch to creation music
        setupAssetsUI();
    }
}