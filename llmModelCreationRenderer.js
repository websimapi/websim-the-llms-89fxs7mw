import * as THREE from 'three';
import { createStandardMaterials } from './llmCharacterRendererUtils.js';
import { prepareModelForIndividualColoring, applyColorToMesh } from './llmMeshColorManager.js';
import { updateManipulationDisplays } from './llmMeshManipulator.js';
import { setGlobalReferences, setModels, setSelectedMesh, getGlobalReferences } from './threeJSGlobals.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; // Import OrbitControls
import { llmDataManager } from './llmDataManager.js'; // Needed for loading data
import { serializeMaterial } from './llmCharacterRendererUtils.js'; // Need this for saving colors

// --- Moved from llmCreationInterface.js ---

// Renamed humanoidScene, etc. to previewScene for clarity
let previewScene, previewCamera, previewRenderer, previewClock;
let robotModel; // Keep track of the default robot model instance
let customCharacter = null; // Keep track of the custom character instance
let selectedMesh = null; // Track the currently selected mesh
let humanoidMixer = null; // Animation mixer
let animationFrameId = null; // Store animation frame ID
let previewControls = null; // Variable for OrbitControls

export function initHumanoidPreview(llmToEdit) {
    const viewport = document.querySelector('.humanoid-viewport');
    if (!viewport) {
        console.error("Humanoid viewport not found!");
        return;
    }

    // Clear existing content and references
    viewport.innerHTML = '';
    previewScene = null;
    robotModel = null;
    customCharacter = null;
    previewControls = null; // Reset controls
    selectedMesh = null;
    humanoidMixer = null;
    if (animationFrameId) { // Check if ID exists before cancelling
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null; // Reset ID
    }

    // Setup Three.js scene
    previewScene = new THREE.Scene();
    previewScene.background = new THREE.Color(0x111111);

    // Setup camera
    previewCamera = new THREE.PerspectiveCamera(
        45,
        viewport.clientWidth / viewport.clientHeight,
        0.1,
        1000
    );
    previewCamera.position.set(0, 1.5, 5); // Slightly further back
    previewCamera.lookAt(0, 1, 0);

    // Setup renderer
    previewRenderer = new THREE.WebGLRenderer({ antialias: true });
    previewRenderer.setSize(viewport.clientWidth, viewport.clientHeight);
    previewRenderer.shadowMap.enabled = true;
    viewport.appendChild(previewRenderer.domElement);

    // Set global references (important for other modules like profile image capture)
    setGlobalReferences(previewScene, previewCamera, previewRenderer);
    setSelectedMesh(null); // Reset global selected mesh

    // Setup OrbitControls for the preview
    previewControls = new OrbitControls(previewCamera, previewRenderer.domElement);
    previewControls.enableDamping = true;
    previewControls.dampingFactor = 0.1;
    previewControls.screenSpacePanning = false; // Keep panning relative to target
    previewControls.minDistance = 2; // Allow zooming in closer
    previewControls.maxDistance = 10; // Allow zooming out a bit more
    previewControls.maxPolarAngle = Math.PI / 1.5; // Allow slightly higher angle
    previewControls.target.set(0, 1, 0); // Focus on the center of the character

    setModels(null, null); // Reset global model references

    // Add click event listener for mesh selection
    previewRenderer.domElement.removeEventListener('click', handleMeshSelection); // Remove previous
    previewRenderer.domElement.addEventListener('click', handleMeshSelection);

    // Setup lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    previewScene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(2, 5, 3);
    directionalLight.castShadow = true;
    previewScene.add(directionalLight);

    // Add ground plane
    const groundGeometry = new THREE.PlaneGeometry(10, 10);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.8,
        metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.position.y = -0.01; // Place ground slightly below origin y=0
    previewScene.add(ground);

    // Load the correct model (custom or default), DO NOT AWAIT HERE
    loadInitialModel(llmToEdit); // Await this to ensure model is loaded before positioning

    // Setup animation clock
    previewClock = new THREE.Clock();

    // Start animation loop
    animatePreview();

    // Handle resize
    window.removeEventListener('resize', previewResizeHandler); // Remove previous
    window.addEventListener('resize', previewResizeHandler);
}

// Helper function to adjust model position vertically
function positionModelOnGround(model) {
    if (!model) return;
    // Ensure world matrix is up-to-date before calculating bounding box
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const lowestPointY = box.min.y;
    // Calculate the current offset from the desired ground position (0)
    const currentOffset = model.position.y - lowestPointY;
    // Set the new Y position to lift the model so its lowest point is at y=0
    // Adding a small epsilon to prevent z-fighting
    model.position.y = -lowestPointY + 0.001;
    console.log(`Positioned model ${model.name || model.uuid} on ground. Lowest point: ${lowestPointY}, New Y: ${model.position.y}`);
}

async function loadInitialModel(llmToEdit) {
    // Clear previous models from the scene first
    if (robotModel && robotModel.parent) robotModel.parent.remove(robotModel);
    if (customCharacter && customCharacter.parent) customCharacter.parent.remove(customCharacter);
    robotModel = null;
    customCharacter = null;
    setModels(null, null); // Update global refs

    let modelToPosition = null;

    if (llmToEdit && llmToEdit.customCharacterCode) {
        try {
            // Dynamically import characterGenerator
            const module = await import('./characterGenerator.js');
            const tempCustomCharacter = module.createCustomCharacter(THREE, llmToEdit.customCharacterCode);
            if (!tempCustomCharacter) throw new Error("createCustomCharacter returned null");

            customCharacter = tempCustomCharacter;
            previewScene.add(customCharacter);
            prepareModelForIndividualColoring(customCharacter);

            // Apply saved model data if it exists BEFORE setting global models and positioning
            if (llmToEdit.modelData) {
                try {
                    const storageModule = await import('./llmModelStorage.js');
                    // applyStoredModelData might change the model's position/rotation
                    storageModule.applyStoredModelData(customCharacter, llmToEdit);
                    // Re-prepare after applying stored data
                    prepareModelForIndividualColoring(customCharacter);
                } catch (err) {
                    console.error("Error applying stored model data:", err);
                }
            }

            setModels(null, customCharacter); // Set global models AFTER applying stored data
            modelToPosition = customCharacter; // Set the model to be positioned

            // Update status
            const statusElement = document.getElementById('generation-status');
            if (statusElement) {
                statusElement.dataset.generatedCode = llmToEdit.customCharacterCode;
                statusElement.textContent = "Custom character loaded.";
            }

        } catch (error) {
            console.error("Error loading custom character:", error);
            const result = await createDefaultRobotModel(llmToEdit); // Await fallback creation
            robotModel = result; // Store the result of the fallback
            modelToPosition = robotModel;
        }
    } else {
        // Create default robot humanoid model
        const result = await createDefaultRobotModel(llmToEdit); // Await creation
        robotModel = result; // Store the result
        modelToPosition = robotModel;
    }

    // Position the final loaded model on the ground AFTER all modifications
    positionModelOnGround(modelToPosition);
}

// Renamed from createDefaultRobot
export async function createDefaultRobotModel(llmToEdit) { // Make async to handle potential async imports
    // Get current selected color or color from edit data
    const color = llmToEdit?.color || document.getElementById('llm-color')?.value || '#3cb371';
    const style = llmToEdit?.style || 'modern';

    // Create the robot model using the imported function
    // Pass the previewScene so it gets added correctly
    const result = createRobotModel(previewScene, color, style); // Pass scene here
    robotModel = result.model;

    // Initialize position - will be corrected by positionModelOnGround later
    robotModel.position.y = 0;

    // Prepare the model for individual part coloring
    prepareModelForIndividualColoring(robotModel);

    // Apply stored model data if editing and model data exists
    // This needs to happen BEFORE setting global models and positioning
    if (llmToEdit && llmToEdit.modelData && !llmToEdit.customCharacterCode) {
        try {
            const module = await import('./llmModelStorage.js');
            // applyStoredModelData modifies the robotModel in place
            module.applyStoredModelData(robotModel, llmToEdit);
            // Ensure model is prepared for individual coloring after applying stored data
            prepareModelForIndividualColoring(robotModel);
            console.log("Applied stored model data to robot in createDefaultRobotModel.");
        } catch (err) {
            console.error("Error applying stored model data to robot:", err);
        }
    }

    // Update global references AFTER applying potential stored data
    setModels(robotModel, null);

    // --- Setup Animation ---
    if (robotModel.animations && robotModel.animations.length > 0) {
        humanoidMixer = new THREE.AnimationMixer(robotModel);
        const walkAction = humanoidMixer.clipAction(robotModel.animations[0]); // Assuming walk is the first animation
        walkAction.play();
    } else {
        console.warn("Robot model created without animations.");
        humanoidMixer = null;
    }

    return robotModel; // Return the created model
}

function handleMeshSelection(event) {
    // Clear previous selection highlight visually
    if (selectedMesh && selectedMesh.userData.originalEmissive) {
        if (selectedMesh.material && selectedMesh.material.emissive) {
            // Check if originalEmissive is a Color object before copying
            if (selectedMesh.userData.originalEmissive instanceof THREE.Color) {
                selectedMesh.material.emissive.copy(selectedMesh.userData.originalEmissive);
            } else {
                console.warn("originalEmissive was not a Color object, resetting emissive.");
                selectedMesh.material.emissive.setHex(0x000000); // Reset to black if unsure
            }
        }
        // Remove the property regardless
        delete selectedMesh.userData.originalEmissive;
    }
    selectedMesh = null; // Reset internal selection state
    setSelectedMesh(null); // Update global state

    const viewport = document.querySelector('.humanoid-viewport');
    if (!viewport || !previewRenderer || !previewCamera) return;
    const rect = viewport.getBoundingClientRect();

    const mouse = {
        x: ((event.clientX - rect.left) / viewport.clientWidth) * 2 - 1,
        y: -((event.clientY - rect.top) / viewport.clientHeight) * 2 + 1
    };

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, previewCamera);

    const meshes = [];
    const currentModel = customCharacter || robotModel;
    if (currentModel) {
        currentModel.traverse(child => {
            if (child.isMesh && child.visible) meshes.push(child);
        });
    }

    const intersects = raycaster.intersectObjects(meshes);
    const selectedMeshNameEl = document.getElementById('selected-mesh-name');

    if (intersects.length > 0) {
        selectedMesh = intersects[0].object;
        setSelectedMesh(selectedMesh); // Update global state

        // Highlight
        if (selectedMesh.material && selectedMesh.material.emissive) {
            // Store original only if it doesn't exist or isn't the highlight color
            if (!selectedMesh.userData.originalEmissive || selectedMesh.material.emissive.getHex() !== 0x555555) {
                selectedMesh.userData.originalEmissive = selectedMesh.material.emissive.clone();
            }
            selectedMesh.material.emissive.setHex(0x555555); // Highlight color
        } else if (selectedMesh.material && !selectedMesh.material.emissive) {
            console.warn("Selected mesh material has no emissive property:", selectedMesh.name);
        }

        // Update color picker
        if (selectedMesh.material.color) {
            const colorPicker = document.getElementById('llm-color');
            if (colorPicker) {
                colorPicker.value = '#' + selectedMesh.material.color.getHexString();
            }
        }

        // Update name display
        if (selectedMeshNameEl) {
            const displayName = selectedMesh.name || `Part ${meshes.indexOf(selectedMesh) + 1}`;
            let partType = "";
            let partName = displayName;
            if (displayName.includes('_')) {
                const nameParts = displayName.split('_');
                partType = nameParts[0];
                partName = nameParts.slice(1).join(' ');
            }
            selectedMeshNameEl.innerHTML = partType ? `${partName} <span class="part-type">${partType}</span>` : displayName;
            selectedMeshNameEl.classList.remove('hidden');
        }

        updateManipulationDisplays(); // Show controls and update values
    } else {
        // Clicked elsewhere - Deselect
        if (selectedMeshNameEl) selectedMeshNameEl.classList.add('hidden');
        const manipulationControls = document.querySelector('.manipulation-controls');
        const noSelectionMessage = document.querySelector('.no-selection-message');
        if (manipulationControls) manipulationControls.style.display = 'none';
        if (noSelectionMessage) noSelectionMessage.style.display = 'block';
    }
}

export async function updateSelectedMeshColor() { // Make async to handle createDefaultRobotModel
    const colorInput = document.getElementById('llm-color');
    if (!colorInput) return;
    const color = colorInput.value;
    const { selectedMesh: currentSelectedMesh, models: currentModels } = getGlobalReferences(); // Use destructured values

    if (currentSelectedMesh && currentSelectedMesh.material) {
        applyColorToMesh(currentSelectedMesh, color);
        // Update originalEmissive based on new color
        if (currentSelectedMesh.material.emissive && currentSelectedMesh.userData.originalEmissive) {
            const emissiveColor = new THREE.Color(color).multiplyScalar(0.2);
            // Ensure originalEmissive is a Color object before copying
            if (currentSelectedMesh.userData.originalEmissive instanceof THREE.Color) {
                currentSelectedMesh.userData.originalEmissive.copy(emissiveColor);
            } else {
                console.warn("Cannot copy to originalEmissive, it's not a Color object.");
                // Attempt to re-initialize it
                currentSelectedMesh.userData.originalEmissive = emissiveColor.clone();
            }
            // Keep the highlight color distinct if it's currently selected
            // Use the global selectedMesh reference for comparison consistency
            const globallySelectedMesh = getGlobalReferences().selectedMesh;
            if (currentSelectedMesh === globallySelectedMesh) {
                currentSelectedMesh.material.emissive.setHex(0x555555); // Reapply highlight
            }
        }
    } else {
        // If no mesh is selected, recreate the default robot with the new color
        // Only do this if a custom character isn't currently displayed
        // Check if currentModels is available before accessing customCharacter
        if (currentModels && !currentModels.customCharacter) {
            // Pass the llmToEdit context if available (might be null if creating new)
            const createUI = document.getElementById('create-llm-ui');
            let llmToEdit = null;
            if (createUI && createUI.getAttribute('data-edit-mode') === 'true') {
                const editId = createUI.getAttribute('data-edit-id');
                if (editId) {
                    llmToEdit = llmDataManager.getLLMById(editId);
                }
            }
            // Recreate default robot with current color picker value
            const newRobot = await createDefaultRobotModel(llmToEdit);
            // Position the newly created robot
            positionModelOnGround(newRobot);
        }
    }
}

// Renamed animateHumanoid to animatePreview
// let animationFrameId = null; // Already declared globally
function animatePreview() {
    if (!previewScene || !previewCamera || !previewRenderer) {
        console.log("Skipping preview animation: scene/camera/renderer missing");
        return;
    }
    animationFrameId = requestAnimationFrame(animatePreview);

    const delta = previewClock.getDelta(); // Get time delta for animation

    // Update the animation mixer if it exists
    if (humanoidMixer) {
        humanoidMixer.update(delta);
    }

    // Update OrbitControls if they exist
    if (previewControls) {
        previewControls.update();
    }

    previewRenderer.render(previewScene, previewCamera);
}

// Renamed humanoidResizeHandler to previewResizeHandler
function previewResizeHandler() {
    const viewport = document.querySelector('.humanoid-viewport');
    if (previewCamera && previewRenderer && viewport) {
        previewCamera.aspect = viewport.clientWidth / viewport.clientHeight;
        previewCamera.updateProjectionMatrix();
        previewRenderer.setSize(viewport.clientWidth, viewport.clientHeight);
    }
}

// Function to update the preview when a new custom character is generated
// This needs to be called from llmCreationInterface after generation completes
export async function displayGeneratedCharacter(generatedCode) {
    if (!previewScene) return;

    // Stop and remove previous animation mixer
    if (humanoidMixer) {
        humanoidMixer.stopAllAction();
        humanoidMixer = null;
    }

    // Remove previous custom character
    if (customCharacter && customCharacter.parent) {
        customCharacter.parent.remove(customCharacter);
    }
    // Remove default robot model
    if (robotModel && robotModel.parent) {
        robotModel.parent.remove(robotModel);
    }
    robotModel = null;
    customCharacter = null;
    setModels(null, null); // Clear global refs

    try {
        // Dynamically import if needed
        const module = await import('./characterGenerator.js');
        const newCustomCharacter = module.createCustomCharacter(THREE, generatedCode);
        if (!newCustomCharacter) throw new Error("createCustomCharacter returned null");

        customCharacter = newCustomCharacter; // Assign to global
        previewScene.add(customCharacter);
        prepareModelForIndividualColoring(customCharacter);

        // Apply saved data if exists (relevant if regenerating during edit)
        const createUI = document.getElementById('create-llm-ui');
        let llmToEdit = null;
        if (createUI && createUI.getAttribute('data-edit-mode') === 'true') {
            const editId = createUI.getAttribute('data-edit-id');
            if (editId) {
                llmToEdit = llmDataManager.getLLMById(editId);
                if (llmToEdit && llmToEdit.modelData) {
                    const storageModule = await import('./llmModelStorage.js');
                    storageModule.applyStoredModelData(customCharacter, llmToEdit);
                    prepareModelForIndividualColoring(customCharacter);
                }
            }
        }

        setModels(null, customCharacter); // Update global refs AFTER applying data

        // Position the newly created character on the ground
        positionModelOnGround(customCharacter);

        const statusElement = document.getElementById('generation-status');
        if (statusElement) statusElement.textContent = "Character generated successfully!";

        // Custom characters don't have default animations yet
        humanoidMixer = null;

    } catch (error) {
        console.error("Error displaying generated character:", error);
        const statusElement = document.getElementById('generation-status');
        if (statusElement) statusElement.textContent = "Error displaying generated character.";
    }
}

// Function to reset the preview to the default robot
export async function resetPreviewModel() { // Make async
    await loadInitialModel(); // Call with no llmToEdit to load default
}

// New function to restore the default robot model while preserving colors
export async function restoreDefaultRobotModel() {
    if (!previewScene) return;
    console.log("Restoring default robot model...");

    // 1. Get current model and serialize its colors by name
    const currentModel = customCharacter || robotModel;
    const currentColors = {};
    if (currentModel) {
        currentModel.traverse(child => {
            if (child.isMesh && child.name && child.material) {
                currentColors[child.name] = serializeMaterial(child.material); // Save serialized material props
            }
        });
    }
    console.log("Saved colors from current model:", currentColors);

    // 2. Stop animation and remove current model(s)
    if (humanoidMixer) {
        humanoidMixer.stopAllAction();
        humanoidMixer = null;
    }
    if (customCharacter && customCharacter.parent) customCharacter.parent.remove(customCharacter);
    if (robotModel && robotModel.parent) robotModel.parent.remove(robotModel);
    customCharacter = null;
    robotModel = null;
    setModels(null, null);
    setSelectedMesh(null); // Deselect mesh

    // 3. Create the default robot model
    // Use the current color picker value as the base color
    const baseColor = document.getElementById('llm-color')?.value || '#3cb371';
    const result = await createRobotModel(previewScene, baseColor, 'modern'); // Use base color
    robotModel = result.model; // Store new robot model
    setModels(robotModel, null); // Update global reference

    // 4. Apply stored colors to the new robot model
    robotModel.traverse(child => {
        if (child.isMesh && child.name && currentColors[child.name]) {
            const savedMaterialData = currentColors[child.name];
            if (savedMaterialData.color) {
                applyColorToMesh(child, savedMaterialData.color); // Apply saved color
            }
        }
    });

    // 5. Position the new robot model on the ground
    positionModelOnGround(robotModel);
    console.log("Default robot restored and colors applied.");
}

// --- Create Robot Model with Hierarchy and Animation ---
export function createRobotModel(targetScene, color, style) {
    const parent = targetScene || new THREE.Group();
    const materials = createStandardMaterials(color, style);
    const robotGroup = new THREE.Group();
    robotGroup.name = "RobotModel";
    parent.add(robotGroup); // Add to parent immediately

    // Constants
    const armSegmentLength = 0.3, armRadius = 0.06;
    const legSegmentLength = 0.35, legRadius = 0.07;
    const headHeight = 0.4;
    const torsoHeight = 0.8;
    const neckHeight = 0.15;
    const pelvisHeight = 0.15;

    // --- Body Hierarchy ---
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.3, pelvisHeight, 0.2), materials.bodyMaterial);
    pelvis.name = "Body_Pelvis";
    robotGroup.add(pelvis); // Base of the hierarchy

    const torsoGroup = new THREE.Group();
    torsoGroup.name = "TorsoGroup"; // Group for torso elements
    torsoGroup.position.y = pelvisHeight / 2 + torsoHeight / 2; // Position relative to pelvis center
    pelvis.add(torsoGroup); // Torso attached to pelvis

    const torsoShape = new THREE.Shape();
    const tx = -0.25, ty = -torsoHeight / 2, tWidth = 0.5, tRadius = 0.1;
    torsoShape.moveTo(tx, ty + tRadius).lineTo(tx, ty + torsoHeight - tRadius).quadraticCurveTo(tx, ty + torsoHeight, tx + tRadius, ty + torsoHeight).lineTo(tx + tWidth - tRadius, ty + torsoHeight).quadraticCurveTo(tx + tWidth, ty + torsoHeight, tx + tWidth, ty + torsoHeight - tRadius).lineTo(tx + tWidth, ty + tRadius).quadraticCurveTo(tx + tWidth, ty, tx + tWidth - tRadius, ty).lineTo(tx + tRadius, ty).quadraticCurveTo(tx, ty, tx, ty + tRadius);
    const torsoExtrudeSettings = { depth: 0.25, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 };
    const torsoGeometry = new THREE.ExtrudeGeometry(torsoShape, torsoExtrudeSettings);
    torsoGeometry.center(); // Center geometry locally
    const torsoMain = new THREE.Mesh(torsoGeometry, materials.bodyMaterial);
    torsoMain.name = "Body_Torso";
    torsoGroup.add(torsoMain);

    const chestLight = new THREE.Mesh(new THREE.CircleGeometry(0.08, 32), materials.chestLightMaterial);
    chestLight.position.set(0, 0.1, 0.13); // Local position within torso group
    chestLight.name = "Body_ChestLight";
    torsoGroup.add(chestLight);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, neckHeight), materials.limbsMaterial);
    neck.name = "Body_Neck";
    neck.position.y = torsoHeight / 2 + neckHeight / 2; // Position neck top relative to torso top
    torsoGroup.add(neck);

    const headGroup = new THREE.Group();
    headGroup.name = "HeadGroup"; // Separate group for head elements
    headGroup.position.y = neckHeight / 2 + headHeight / 2; // Position head relative to neck
    neck.add(headGroup); // Head attached to neck

    const headShape = new THREE.Shape();
    const hx = -0.2, hy = -headHeight / 2, hWidth = 0.4, hRadius = 0.08;
    headShape.moveTo(hx, hy + hRadius).lineTo(hx, hy + headHeight - hRadius).quadraticCurveTo(hx, hy + headHeight, hx + hRadius, hy + headHeight).lineTo(hx + hWidth - hRadius, hy + headHeight).quadraticCurveTo(hx + hWidth, hy + headHeight, hx + hWidth, hy + headHeight - hRadius).lineTo(hx + hWidth, hy + hRadius).quadraticCurveTo(hx + hWidth, hy, hx + hWidth - hRadius, hy).lineTo(hx + hRadius, hy).quadraticCurveTo(hx, hy, hx, hy + hRadius);
    const headExtrudeSettings = { depth: 0.3, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 };
    const headGeometry = new THREE.ExtrudeGeometry(headShape, headExtrudeSettings);
    headGeometry.center(); // Center geometry locally
    const headMain = new THREE.Mesh(headGeometry, materials.headMaterial);
    headMain.name = "Head_Main";
    headGroup.add(headMain);

    const eyeGeometry = new THREE.SphereGeometry(0.05, 16, 8);
    const leftEye = new THREE.Mesh(eyeGeometry, materials.eyeMaterial);
    leftEye.position.set(-0.08, 0.04, 0.16); leftEye.name = "Head_LeftEye"; headGroup.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeometry, materials.eyeMaterial);
    rightEye.position.set(0.08, 0.04, 0.16); rightEye.name = "Head_RightEye"; headGroup.add(rightEye);

    const antennaBase = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05), materials.limbsMaterial);
    antennaBase.position.set(0, headHeight / 2 + 0.025, 0); antennaBase.name = "Head_AntennaBase"; headGroup.add(antennaBase);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.15), materials.limbsMaterial);
    antenna.position.set(0, antennaBase.position.y + 0.025 + 0.075, 0); antenna.name = "Head_Antenna"; headGroup.add(antenna);
    const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), materials.antennaTipMaterial);
    antennaTip.position.set(0, antenna.position.y + 0.075 + 0.01, 0); antennaTip.name = "Head_AntennaTip"; headGroup.add(antennaTip);

    // --- Limb Hierarchy & Joints ---
    const shoulderOffsetY = torsoHeight / 2 - 0.1; // Relative to torso center
    const hipOffsetY = -pelvisHeight / 2;          // Relative to pelvis center

    // --- Left Arm ---
    const leftShoulderGroup = new THREE.Group();
    leftShoulderGroup.name = "LeftShoulder";
    leftShoulderGroup.position.set(-0.35, shoulderOffsetY, 0); // Position relative to torso group
    torsoGroup.add(leftShoulderGroup);
    const leftShoulderJoint = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 8), materials.limbsMaterial);
    leftShoulderJoint.name = "Body_LeftShoulderJoint"; leftShoulderGroup.add(leftShoulderJoint); // Joint mesh is visual only, group does rotation

    const leftUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(armRadius, armRadius * 0.9, armSegmentLength), materials.limbsMaterial);
    leftUpperArm.name = "LeftArm_Upper";
    leftUpperArm.position.y = -armSegmentLength / 2 - 0.05; // Position relative to shoulder group center
    leftShoulderGroup.add(leftUpperArm);

    const leftElbowGroup = new THREE.Group();
    leftElbowGroup.name = "LeftElbow";
    leftElbowGroup.position.y = -armSegmentLength / 2 - 0.035; // Position relative to upper arm's bottom
    leftUpperArm.add(leftElbowGroup); // Elbow group attached to upper arm mesh
    const leftElbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), materials.limbsMaterial);
    leftElbowJoint.name = "LeftArm_ElbowJoint"; leftElbowGroup.add(leftElbowJoint);

    const leftLowerArm = new THREE.Mesh(new THREE.CylinderGeometry(armRadius * 0.9, armRadius * 0.8, armSegmentLength), materials.limbsMaterial);
    leftLowerArm.name = "LeftArm_Lower";
    leftLowerArm.position.y = -armSegmentLength / 2 - 0.035; // Position relative to elbow group center
    leftElbowGroup.add(leftLowerArm);

    const leftHandGroup = createDetailedHand(materials, 'left');
    leftHandGroup.name = "LeftArm_HandGroup";
    leftHandGroup.position.y = -armSegmentLength / 2 - 0.06; // Position relative to lower arm's bottom
    leftLowerArm.add(leftHandGroup); // Hand group attached to lower arm mesh

    // --- Right Arm (Similar structure) ---
    const rightShoulderGroup = new THREE.Group();
    rightShoulderGroup.name = "RightShoulder";
    rightShoulderGroup.position.set(0.35, shoulderOffsetY, 0);
    torsoGroup.add(rightShoulderGroup);
    const rightShoulderJoint = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 8), materials.limbsMaterial);
    rightShoulderJoint.name = "Body_RightShoulderJoint"; rightShoulderGroup.add(rightShoulderJoint);

    const rightUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(armRadius, armRadius * 0.9, armSegmentLength), materials.limbsMaterial);
    rightUpperArm.name = "RightArm_Upper";
    rightUpperArm.position.y = -armSegmentLength / 2 - 0.05;
    rightShoulderGroup.add(rightUpperArm);

    const rightElbowGroup = new THREE.Group();
    rightElbowGroup.name = "RightElbow";
    rightElbowGroup.position.y = -armSegmentLength / 2 - 0.035;
    rightUpperArm.add(rightElbowGroup);
    const rightElbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), materials.limbsMaterial);
    rightElbowJoint.name = "RightArm_ElbowJoint"; rightElbowGroup.add(rightElbowJoint);

    const rightLowerArm = new THREE.Mesh(new THREE.CylinderGeometry(armRadius * 0.9, armRadius * 0.8, armSegmentLength), materials.limbsMaterial);
    rightLowerArm.name = "RightArm_Lower";
    rightLowerArm.position.y = -armSegmentLength / 2 - 0.035;
    rightElbowGroup.add(rightLowerArm);

    const rightHandGroup = createDetailedHand(materials, 'right');
    rightHandGroup.name = "RightArm_HandGroup";
    rightHandGroup.position.y = -armSegmentLength / 2 - 0.06;
    rightLowerArm.add(rightHandGroup);

    // --- Left Leg ---
    const leftHipGroup = new THREE.Group();
    leftHipGroup.name = "LeftHip";
    leftHipGroup.position.set(-0.12, hipOffsetY, 0); // Position relative to pelvis group
    pelvis.add(leftHipGroup);
    const leftHipJoint = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), materials.limbsMaterial);
    leftHipJoint.name = "Body_LeftHipJoint"; leftHipGroup.add(leftHipJoint);

    const leftUpperLeg = new THREE.Mesh(new THREE.CylinderGeometry(legRadius, legRadius * 0.9, legSegmentLength), materials.limbsMaterial);
    leftUpperLeg.name = "LeftLeg_Upper";
    leftUpperLeg.position.y = -legSegmentLength / 2 - 0.045; // Position relative to hip group center
    leftHipGroup.add(leftUpperLeg);

    const leftKneeGroup = new THREE.Group();
    leftKneeGroup.name = "LeftKnee";
    leftKneeGroup.position.y = -legSegmentLength / 2 - 0.04; // Position relative to upper leg's bottom
    leftUpperLeg.add(leftKneeGroup);
    const leftKneeJoint = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), materials.limbsMaterial);
    leftKneeJoint.name = "LeftLeg_KneeJoint"; leftKneeGroup.add(leftKneeJoint);

    const leftLowerLeg = new THREE.Mesh(new THREE.CylinderGeometry(legRadius * 0.9, legRadius * 0.8, legSegmentLength), materials.limbsMaterial);
    leftLowerLeg.name = "LeftLeg_Lower";
    leftLowerLeg.position.y = -legSegmentLength / 2 - 0.04; // Position relative to knee group center
    leftKneeGroup.add(leftLowerLeg);

    const leftFoot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.22), materials.limbsMaterial);
    leftFoot.name = "LeftLeg_Foot";
    leftFoot.position.y = -legSegmentLength / 2 - 0.04; // Position relative to lower leg's bottom
    leftFoot.position.z = 0.05; // Offset foot slightly forward
    leftLowerLeg.add(leftFoot); // Foot attached to lower leg mesh

    // --- Right Leg (Similar structure) ---
    const rightHipGroup = new THREE.Group();
    rightHipGroup.name = "RightHip";
    rightHipGroup.position.set(0.12, hipOffsetY, 0);
    pelvis.add(rightHipGroup);
    const rightHipJoint = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), materials.limbsMaterial);
    rightHipJoint.name = "Body_RightHipJoint"; rightHipGroup.add(rightHipJoint);

    const rightUpperLeg = new THREE.Mesh(new THREE.CylinderGeometry(legRadius, legRadius * 0.9, legSegmentLength), materials.limbsMaterial);
    rightUpperLeg.name = "RightLeg_Upper";
    rightUpperLeg.position.y = -legSegmentLength / 2 - 0.045;
    rightHipGroup.add(rightUpperLeg);

    const rightKneeGroup = new THREE.Group();
    rightKneeGroup.name = "RightKnee";
    rightKneeGroup.position.y = -legSegmentLength / 2 - 0.04;
    rightUpperLeg.add(rightKneeGroup);
    const rightKneeJoint = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), materials.limbsMaterial);
    rightKneeJoint.name = "RightLeg_KneeJoint"; rightKneeGroup.add(rightKneeJoint);

    const rightLowerLeg = new THREE.Mesh(new THREE.CylinderGeometry(legRadius * 0.9, legRadius * 0.8, legSegmentLength), materials.limbsMaterial);
    rightLowerLeg.name = "RightLeg_Lower";
    rightLowerLeg.position.y = -legSegmentLength / 2 - 0.04;
    rightKneeGroup.add(rightLowerLeg);

    const rightFoot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.22), materials.limbsMaterial);
    rightFoot.name = "RightLeg_Foot";
    rightFoot.position.y = -legSegmentLength / 2 - 0.04;
    rightFoot.position.z = 0.05;
    rightLowerLeg.add(rightFoot);

    // --- Shadows ---
    robotGroup.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    // --- Animation Definition ---
    const walkCycleTime = 1.0; // Duration of one walk cycle in seconds
    const halfCycle = walkCycleTime / 2;
    const quarterCycle = walkCycleTime / 4;

    const hipSwing = Math.PI / 8; // Radians
    const kneeBend = Math.PI / 4;
    const shoulderSwing = Math.PI / 6;
    const elbowBend = Math.PI / 8;

    const times = [0, quarterCycle, halfCycle, halfCycle + quarterCycle, walkCycleTime];

    // Keyframes for Left Hip (swing forward/back)
    const leftHipRotateX = new THREE.KeyframeTrack(
        'LeftHip.rotation[x]', // Target the group's rotation
        times,
        [-hipSwing, 0, hipSwing, 0, -hipSwing].map(v => v) // Values at each time step
    );

    // Keyframes for Left Knee (bend when leg is forward/back)
    const leftKneeRotateX = new THREE.KeyframeTrack(
        'LeftKnee.rotation[x]',
        times,
        [kneeBend, 0, 0, 0, kneeBend].map(v => v)
    );

    // Keyframes for Right Hip (opposite swing)
    const rightHipRotateX = new THREE.KeyframeTrack(
        'RightHip.rotation[x]',
        times,
        [hipSwing, 0, -hipSwing, 0, hipSwing].map(v => v)
    );

    // Keyframes for Right Knee (opposite bend)
    const rightKneeRotateX = new THREE.KeyframeTrack(
        'RightKnee.rotation[x]',
        times,
        [0, 0, kneeBend, 0, 0].map(v => v)
    );

    // Keyframes for Left Shoulder (opposite of left hip)
    const leftShoulderRotateX = new THREE.KeyframeTrack(
        'LeftShoulder.rotation[x]',
        times,
        [shoulderSwing, 0, -shoulderSwing, 0, shoulderSwing].map(v => v)
    );
    // Keyframes for Left Elbow
    const leftElbowRotateX = new THREE.KeyframeTrack(
        'LeftElbow.rotation[x]',
        times,
        [elbowBend, elbowBend / 2, 0, elbowBend / 2, elbowBend].map(v => v)
    );

    // Keyframes for Right Shoulder (opposite of right hip)
    const rightShoulderRotateX = new THREE.KeyframeTrack(
        'RightShoulder.rotation[x]',
        times,
        [-shoulderSwing, 0, shoulderSwing, 0, -shoulderSwing].map(v => v)
    );
    // Keyframes for Right Elbow
    const rightElbowRotateX = new THREE.KeyframeTrack(
        'RightElbow.rotation[x]',
        times,
        [0, elbowBend / 2, elbowBend, elbowBend / 2, 0].map(v => v)
    );

    // Create the Animation Clip
    const walkAnimationClip = new THREE.AnimationClip(
        'walk', // Animation name
        walkCycleTime, // Duration
        [
            leftHipRotateX, leftKneeRotateX,
            rightHipRotateX, rightKneeRotateX,
            leftShoulderRotateX, leftElbowRotateX,
            rightShoulderRotateX, rightElbowRotateX
        ]
    );

    // Attach animation clip to the model
    robotGroup.animations = [walkAnimationClip];

    return {
        model: robotGroup,
        materials: materials
    };
}

// Helper function to create a more detailed hand
function createDetailedHand(materials, side) {
    const handGroup = new THREE.Group();
    handGroup.name = `HandGroup_${side}`; // Unique name for the group

    // Palm
    const palmGeometry = new THREE.BoxGeometry(0.08, 0.1, 0.04);
    const palm = new THREE.Mesh(palmGeometry, materials.limbsMaterial);
    palm.name = `${side}Hand_Palm`; // Unique name
    handGroup.add(palm);

    // Fingers (simplified cylinders)
    const fingerGeometry = new THREE.CylinderGeometry(0.015, 0.01, 0.08);
    const fingerMaterial = materials.limbsMaterial; // Can clone if different colors needed

    // Finger positions relative to palm center
    const fingerPositions = [
        { x: -0.03, y: -0.06, scaleY: 1.0 },    // Index
        { x: 0, y: -0.065, scaleY: 1.05 },   // Middle
        { x: 0.03, y: -0.06, scaleY: 1.0 }     // Ring
    ];

    fingerPositions.forEach((pos, i) => {
        const finger = new THREE.Mesh(fingerGeometry, fingerMaterial);
        finger.scale.y = pos.scaleY;
        finger.position.set(pos.x, pos.y, 0);
        finger.name = `${side}Hand_Finger${i + 1}`; // Unique name
        handGroup.add(finger);
    });

    return handGroup;
}