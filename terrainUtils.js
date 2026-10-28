import * as THREE from 'three';

// Generate more realistic terrain variation
export function generateTerrainVariation(geometry, amplitude, frequency, offset = 0) {
    const vertices = geometry.attributes.position;
    
    for (let i = 0; i < vertices.count; i++) {
        const x = vertices.getX(i);
        const z = vertices.getZ(i);
        
        const nx = (x + offset) * frequency;
        const nz = (z + offset) * frequency;
        
        // Use multiple noise frequencies for more natural looking terrain
        const y = (
            simplex(nx, nz) * amplitude +
            simplex(nx * 2, nz * 2) * amplitude * 0.5 +
            simplex(nx * 4, nz * 4) * amplitude * 0.25
        );
        
        vertices.setY(i, y);
    }
    
    vertices.needsUpdate = true;
    return geometry;
}

// Simple implementation of simplex-like noise for terrain generation
function simplex(x, z) {
    // This is a simple approximation, not true simplex noise
    // But it gives terrain-like results for our purposes
    return Math.sin(x) * Math.cos(z) + 
           Math.sin(x * 1.5) * Math.cos(z * 1.7) * 0.5 + 
           Math.sin(x * 3.7) * Math.cos(z * 2.9) * 0.25;
}

// Create cloud/mist layers in the horizon to enhance infinite terrain effect
export function createDistanceMist(scene, distance, height) {
    // Create several layers of mist/clouds
    const mistLayers = [];
    const colors = [0xeef4ed, 0xd9efd8, 0xcce6c7];
    
    for (let i = 0; i < 3; i++) {
        const mistGeometry = new THREE.PlaneGeometry(distance * 3, 50, 5, 5);
        
        // Curve the mist to follow horizon
        const vertices = mistGeometry.attributes.position;
        for (let j = 0; j < vertices.count; j++) {
            const y = vertices.getY(j);
            const z = vertices.getZ(j);
            
            // Add some wave effect to the mist
            vertices.setY(j, y + Math.sin(z * 0.05) * 5);
            
            // Curve it to follow horizon curvature
            const x = vertices.getX(j);
            const distFromCenter = Math.abs(x);
            vertices.setZ(j, z - Math.pow(distFromCenter * 0.003, 2));
        }
        
        const mistMaterial = new THREE.MeshBasicMaterial({
            color: colors[i],
            transparent: true,
            opacity: 0.25 - (i * 0.05),
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        
        const mist = new THREE.Mesh(mistGeometry, mistMaterial);
        mist.position.y = height + (i * 15);
        mist.position.z = -distance - (i * 200);
        mist.rotation.x = Math.PI / 2.5;
        
        scene.add(mist);
        mistLayers.push(mist);
    }
    
    return mistLayers;
}
