import * as THREE from 'three';

// Class to manage camera boundaries in the scene
export class CameraBoundaryController {
    constructor(camera, controls, bounds) {
        this.camera = camera;
        this.controls = controls;
        this.bounds = bounds || { min: -250, max: 250 }; // Default bounds
        this.enabled = true;
        
        // Bind methods
        this.update = this.update.bind(this);
        
        // Initialize
        this.originalTarget = controls.target.clone();
        this.lastValidPosition = camera.position.clone();
        
        // Track if we're currently restricting movement
        this.restrictingMovement = false;
    }
    
    // Enable or disable boundary control
    setEnabled(enabled) {
        this.enabled = enabled;
    }
    
    // Update bounds
    setBounds(bounds) {
        this.bounds = bounds;
    }
    
    // Call this method in the animation loop
    update() {
        if (!this.enabled) return;
        
        // Store a reference to the current camera position
        const position = this.camera.position.clone();
        
        // Calculate camera direction vector (from target to camera)
        const directionToCamera = new THREE.Vector3().subVectors(position, this.controls.target).normalize();
        
        // Check boundaries separately for each axis
        let xOutOfBounds = false;
        let zOutOfBounds = false;
        
        // Check X bounds
        if (position.x < this.bounds.min) {
            xOutOfBounds = true;
            position.x = this.bounds.min;
        } else if (position.x > this.bounds.max) {
            xOutOfBounds = true;
            position.x = this.bounds.max;
        }
        
        // Check Z bounds
        if (position.z < this.bounds.min) {
            zOutOfBounds = true;
            position.z = this.bounds.min;
        } else if (position.z > this.bounds.max) {
            zOutOfBounds = true;
            position.z = this.bounds.max;
        }
        
        // If out of bounds, restrict only the affected dimension
        if (xOutOfBounds || zOutOfBounds) {
            this.restrictingMovement = true;
            
            // Apply the corrected position to the camera
            this.camera.position.copy(position);
            
            // Check if orbit controls target is outside boundary
            const target = this.controls.target.clone();
            let targetNeedsUpdate = false;
            
            if (target.x < this.bounds.min) {
                target.x = this.bounds.min;
                targetNeedsUpdate = true;
            } else if (target.x > this.bounds.max) {
                target.x = this.bounds.max;
                targetNeedsUpdate = true;
            }
            
            if (target.z < this.bounds.min) {
                target.z = this.bounds.min;
                targetNeedsUpdate = true;
            } else if (target.z > this.bounds.max) {
                target.z = this.bounds.max;
                targetNeedsUpdate = true;
            }
            
            // Update orbit controls target if needed
            if (targetNeedsUpdate) {
                this.controls.target.copy(target);
                this.controls.update();
            }
        } else {
            this.restrictingMovement = false;
            // Update last valid position
            this.lastValidPosition.copy(position);
        }
    }
}