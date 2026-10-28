// Central place to manage global references to Three.js objects
let currentHumanoidScene = null;
let humanoidCamera = null;
let humanoidRenderer = null;
let selectedMesh = null;
let robotModel = null;
let customCharacter = null;

// Export functions to set and get global references
export function setGlobalReferences(scene, camera, renderer) {
    currentHumanoidScene = scene;
    humanoidCamera = camera;
    humanoidRenderer = renderer;

    // Also set window variables for backward compatibility
    window.currentHumanoidScene = scene;
    window.humanoidCamera = camera;
    window.humanoidRenderer = renderer;
}

export function getGlobalReferences() {
    return {
        scene: currentHumanoidScene,
        camera: humanoidCamera,
        renderer: humanoidRenderer,
        selectedMesh: selectedMesh, 
        models: getModels() 
    };
}

export function setSelectedMesh(mesh) {
    selectedMesh = mesh;
    window.selectedMesh = mesh;
}

export function getSelectedMesh() {
    return selectedMesh;
}

export function setModels(robot, custom) {
    if (robot) {
        robotModel = robot;
        window.robotModel = robot;
    }
    
    if (custom) {
        customCharacter = custom;
        window.customCharacter = custom;
    }
}

export function getModels() {
    return {
        robotModel: robotModel,
        customCharacter: customCharacter
    };
}

// Return true if all required Three.js globals are available
export function checkGlobalsAvailable() {
    return Boolean(currentHumanoidScene && humanoidCamera && humanoidRenderer);
}

// Add safety check for emissive property
export function safeSetEmissive(material, color, intensity = 0.3) {
    if (material && material.emissive) {
        material.emissive.set(color);
        if (material.emissiveIntensity !== undefined) {
            material.emissiveIntensity = intensity;
        }
    }
}