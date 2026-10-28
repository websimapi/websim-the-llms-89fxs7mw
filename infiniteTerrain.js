import * as THREE from 'three';
import { config } from './config.js';

// Create a terrain that extends into the distance with fog and LOD
export function createInfiniteTerrain(scene, primaryGroundSize = 500) {
    // Add fog to create distance fade effect
    // Adjusted density for the potentially larger scale
    scene.fog = new THREE.FogExp2(0xe0f5e0, 0.0006); // Slightly less dense fog

    // Create primary ground (high detail, close to camera)
    const groundGeometry = new THREE.PlaneGeometry(primaryGroundSize, primaryGroundSize, 50, 50); // Add segments for potential displacement later
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: config.groundColor || 0x7cfc00, // Use color from config
        roughness: 0.8,
        metalness: 0.2,
        flatShading: false // Keep primary ground smooth
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Create distant terrain pieces (lower detail)
    const terrainSize = primaryGroundSize * 20; // Keep distant terrain large
    const segmentCount = 16;

    const distantGeometry = new THREE.PlaneGeometry(terrainSize, terrainSize, segmentCount, segmentCount);
    const distantMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(config.groundColor || 0x7cfc00).multiplyScalar(0.8), // Slightly darker distant ground
        roughness: 0.9,
        metalness: 0.1,
        flatShading: true // Use flat shading for style and performance
    });
    const distantTerrain = new THREE.Mesh(distantGeometry, distantMaterial);
    distantTerrain.rotation.x = -Math.PI / 2;
    distantTerrain.position.y = -1; // Slightly lower than main ground
    distantTerrain.receiveShadow = true;
    scene.add(distantTerrain);

    // Add more distant mountains terrain for horizon
    const horizonSize = terrainSize * 5;
    const horizonGeometry = new THREE.PlaneGeometry(horizonSize, horizonSize, 12, 12);
    const horizonMaterial = new THREE.MeshStandardMaterial({
        color: 0x5a8c50, // Darker green for distance effect
        roughness: 1.0,
        metalness: 0.0,
        flatShading: true
    });
    const horizonTerrain = new THREE.Mesh(horizonGeometry, horizonMaterial);
    horizonTerrain.rotation.x = -Math.PI / 2;
    horizonTerrain.position.y = -15; // Lower for mountain effect
    scene.add(horizonTerrain);

    // Add terrain variation to distant terrain
    const vertices = distantGeometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
        const x = vertices.getX(i);
        const z = vertices.getZ(i);

        // Only modify vertices that are far from center
        const distFromCenter = Math.sqrt(x * x + z * z);
        if (distFromCenter > primaryGroundSize / 2) {
            // Add more dramatic height variation for distant terrain
            vertices.setY(i, Math.sin(x * 0.005) * Math.cos(z * 0.005) * 25 - 8);
        }
    }
    distantGeometry.computeVertexNormals(); // Recalculate normals for lighting
    vertices.needsUpdate = true;

    // Add even more dramatic variation to horizon terrain
    const horizonVertices = horizonGeometry.attributes.position;
    for (let i = 0; i < horizonVertices.count; i++) {
        const x = horizonVertices.getX(i);
        const z = horizonVertices.getZ(i);

        // Create mountain ranges in the far distance with more variation
        horizonVertices.setY(
            i,
            (Math.sin(x * 0.002) * Math.cos(z * 0.002) * 80) +
            (Math.sin(x * 0.01) * Math.cos(z * 0.01) * 25) +
            (Math.sin(x * 0.005 + z * 0.003) * 30) - 15 // Adjust base height if needed
        );
    }
    horizonGeometry.computeVertexNormals(); // Recalculate normals for lighting
    horizonVertices.needsUpdate = true;

    // Return ground references and calculated bounds
    return {
        primaryGround: ground,
        distantTerrain: distantTerrain,
        horizonTerrain: horizonTerrain,
        bounds: {
            min: -primaryGroundSize / 2 + 10, // Camera boundary with 10 unit buffer
            max: primaryGroundSize / 2 - 10
        }
    };
}