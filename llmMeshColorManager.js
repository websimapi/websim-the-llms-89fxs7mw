// Helper functions for managing individual mesh colors in the LLM creation UI
import * as THREE from 'three';

// Ensure each mesh has its own material instance
export function prepareModelForIndividualColoring(model) {
    if (!model) return;
    
    model.traverse(child => {
        if (child.isMesh && child.material) {
            // Clone the material to ensure it's not shared between meshes
            child.material = child.material.clone();
            
            // Store original color for reset functionality
            if (!child.userData.originalColor && child.material.color) {
                child.userData.originalColor = child.material.color.clone();
            }
        }
    });
}

// Apply a color to a specific mesh
export function applyColorToMesh(mesh, colorHex) {
    if (!mesh || !mesh.material) return;
    
    // Ensure we have a unique material instance
    if (!mesh.userData.hasUniqueInstance) {
        mesh.material = mesh.material.clone();
        mesh.userData.hasUniqueInstance = true;
    }
    
    // Apply the color - fixed by importing THREE properly
    const color = new THREE.Color(colorHex);
    mesh.material.color.copy(color);
    
    // If the material has emissive property, update it with a toned down version
    if (mesh.material.emissive) {
        const emissiveColor = new THREE.Color(colorHex).multiplyScalar(0.2);
        
        // Store for selection state
        if (!mesh.userData.originalEmissive) {
            mesh.userData.originalEmissive = emissiveColor.clone();
        } else {
            mesh.userData.originalEmissive.copy(emissiveColor);
        }
    }
}

// Reset all mesh colors to their original values
export function resetMeshColors(model) {
    if (!model) return;
    
    model.traverse(child => {
        if (child.isMesh && child.userData.originalColor) {
            child.material.color.copy(child.userData.originalColor);
            
            if (child.material.emissive && child.userData.originalEmissive) {
                child.material.emissive.copy(child.userData.originalEmissive);
            }
        }
    });
}