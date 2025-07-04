import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';

let camera, scene, renderer;
let controller1, controller2;
let hand1, hand2;
let reticle;
let hitTestSource = null;
let hitTestSourceRequested = false;
let hotelModel = null;
let selectedObject = null;
let handModelFactory;
let initialPinchDistance = null;
let initialScale = null;
let mirrorMode = false;
let mirrorSocket = null;
let modelSpotlight = null;
let lightController = null;
let lightControllerSelected = false;

const statusElement = document.getElementById('status');
const startButton = document.getElementById('startAR');

init();
animate();

function init() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    light.position.set(0.5, 1, 0.25);
    scene.add(light);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 10, 0);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Add spotlight above the model
    modelSpotlight = new THREE.SpotLight(0xffffff, 1.5);
    modelSpotlight.position.set(0, 2, 0);
    modelSpotlight.angle = Math.PI / 4;
    modelSpotlight.penumbra = 0.3;
    modelSpotlight.decay = 2;
    modelSpotlight.distance = 10;
    modelSpotlight.castShadow = true;
    modelSpotlight.shadow.mapSize.width = 1024;
    modelSpotlight.shadow.mapSize.height = 1024;
    modelSpotlight.visible = false; // Hide until model is placed
    scene.add(modelSpotlight);

    // Create light controller (visual handle for moving the light)
    const controllerGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    const controllerMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffff00, 
        emissive: 0xffff00,
        emissiveIntensity: 0.5
    });
    lightController = new THREE.Mesh(controllerGeometry, controllerMaterial);
    lightController.visible = false;
    scene.add(lightController);
    
    // Add a line from controller to model to show light direction
    const lineGeometry = new THREE.BufferGeometry();
    const lineMaterial = new THREE.LineBasicMaterial({ 
        color: 0xffff00, 
        opacity: 0.5, 
        transparent: true 
    });
    const lightLine = new THREE.Line(lineGeometry, lineMaterial);
    lightLine.visible = false;
    scene.add(lightLine);
    lightController.userData.lightLine = lightLine;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial()
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    const loader = new GLTFLoader();
    loader.load('./HotelB_AR.glb?v=' + Date.now(), function (gltf) {
        hotelModel = gltf.scene;
        hotelModel.scale.set(0.005, 0.005, 0.005);
        hotelModel.visible = false;
        
        hotelModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        scene.add(hotelModel);
        statusElement.textContent = 'Model loaded. Ready to start AR.';
    }, 
    function (xhr) {
        statusElement.textContent = 'Loading model... ' + Math.round((xhr.loaded / xhr.total) * 100) + '%';
    },
    function (error) {
        console.error('Error loading model:', error);
        statusElement.textContent = 'Error loading model. Please check console.';
    });

    handModelFactory = new XRHandModelFactory();

    hand1 = renderer.xr.getHand(0);
    hand1.addEventListener('pinchstart', onPinchStart);
    hand1.addEventListener('pinchend', onPinchEnd);
    scene.add(hand1);

    hand2 = renderer.xr.getHand(1);
    hand2.addEventListener('pinchstart', onPinchStart);
    hand2.addEventListener('pinchend', onPinchEnd);
    scene.add(hand2);

    const controllerModelFactory = new XRControllerModelFactory();

    controller1 = renderer.xr.getController(0);
    controller1.addEventListener('selectstart', onSelectStart);
    controller1.addEventListener('selectend', onSelectEnd);
    scene.add(controller1);

    controller2 = renderer.xr.getController(1);
    controller2.addEventListener('selectstart', onSelectStart);
    controller2.addEventListener('selectend', onSelectEnd);
    scene.add(controller2);

    const handModel1 = handModelFactory.createHandModel(hand1, 'mesh');
    hand1.add(handModel1);

    const handModel2 = handModelFactory.createHandModel(hand2, 'mesh');
    hand2.add(handModel2);

    startButton.addEventListener('click', () => {
        const sessionInit = {
            requiredFeatures: ['hit-test', 'hand-tracking'],
            optionalFeatures: ['local-floor', 'bounded-floor']
        };
        navigator.xr.requestSession('immersive-ar', sessionInit).then((session) => {
            renderer.xr.setSession(session);
            startButton.style.display = 'none';
            statusElement.textContent = 'AR session started. Look for a surface to place the model.';
        });
    });

    if ('xr' in navigator) {
        navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
            if (supported) {
                startButton.style.display = 'inline-block';
                statusElement.textContent = 'AR supported. Click Start AR to begin.';
                
                // Also add desktop options for development
                enableDesktopPreview();
            } else {
                statusElement.textContent = 'AR not supported on this device.';
                enableDesktopPreview();
            }
        }).catch(() => {
            statusElement.textContent = 'Error checking AR support.';
            enableDesktopPreview();
        });
    } else {
        statusElement.textContent = 'WebXR not available in this browser.';
        enableDesktopPreview();
    }

    window.addEventListener('resize', onWindowResize);
}

function onPinchStart(event) {
    const controller = event.target;
    
    if (hotelModel && hotelModel.visible) {
        selectedObject = hotelModel;
        controller.userData.selected = selectedObject;
        controller.userData.previousTransform = {
            position: selectedObject.position.clone(),
            rotation: selectedObject.rotation.clone(),
            scale: selectedObject.scale.clone()
        };
    }
}

function onPinchEnd(event) {
    const controller = event.target;
    
    if (controller.userData.selected) {
        controller.userData.selected = undefined;
        selectedObject = null;
    }
}

function onSelectStart(event) {
    const controller = event.target;
    
    if (reticle.visible && !hotelModel.visible) {
        hotelModel.position.setFromMatrixPosition(reticle.matrix);
        hotelModel.visible = true;
        reticle.visible = false;
        
        // Enable and position spotlight
        modelSpotlight.visible = true;
        lightController.visible = true;
        lightController.userData.lightLine.visible = true;
        updateSpotlightPosition();
        
        statusElement.textContent = 'Model placed. Pinch yellow sphere to move light.';
    }
}

function onSelectEnd(event) {
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
    if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        if (hitTestSourceRequested === false) {
            session.requestReferenceSpace('viewer').then((referenceSpace) => {
                session.requestHitTestSource({ space: referenceSpace }).then((source) => {
                    hitTestSource = source;
                });
            });

            session.addEventListener('end', () => {
                hitTestSourceRequested = false;
                hitTestSource = null;
            });

            hitTestSourceRequested = true;
        }

        if (hitTestSource && !hotelModel.visible) {
            const hitTestResults = frame.getHitTestResults(hitTestSource);

            if (hitTestResults.length) {
                const hit = hitTestResults[0];
                reticle.visible = true;
                reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
            } else {
                reticle.visible = false;
            }
        }

        updateHandInteraction(hand1);
        updateHandInteraction(hand2);
        
        // Broadcast VR data for mirror mode
        broadcastVRData();
    }

    renderer.render(scene, camera);
}

function updateHandInteraction(hand) {
    // Check if both hands are pinching
    const hand1Pinching = isPinching(hand1);
    const hand2Pinching = isPinching(hand2);
    
    // Check if we're grabbing the light controller
    if (hand === hand1 || hand === hand2) {
        const pinchPos = getPinchPosition(hand);
        if (pinchPos && lightController && lightController.visible) {
            const distanceToLight = pinchPos.distanceTo(lightController.position);
            
            // If pinching near light controller, select it
            if (distanceToLight < 0.1 && isPinching(hand) && !lightControllerSelected) {
                lightControllerSelected = true;
                hand.userData.selectedLight = true;
                statusElement.textContent = 'Light controller selected. Move to position.';
                return;
            }
            
            // Move light controller if selected
            if (hand.userData.selectedLight && isPinching(hand)) {
                lightController.position.copy(pinchPos);
                updateSpotlightFromController();
                return;
            }
            
            // Release light controller
            if (hand.userData.selectedLight && !isPinching(hand)) {
                hand.userData.selectedLight = false;
                lightControllerSelected = false;
                statusElement.textContent = 'Light positioned. Pinch model or light to move.';
                return;
            }
        }
    }
    
    if (hand1Pinching && hand2Pinching && hotelModel && hotelModel.visible) {
        // Two-handed scaling
        const hand1Pos = getPinchPosition(hand1);
        const hand2Pos = getPinchPosition(hand2);
        
        if (hand1Pos && hand2Pos) {
            const currentDistance = hand1Pos.distanceTo(hand2Pos);
            
            if (initialPinchDistance === null) {
                initialPinchDistance = currentDistance;
                initialScale = hotelModel.scale.x;
            } else {
                const scaleFactor = currentDistance / initialPinchDistance;
                const newScale = initialScale * scaleFactor;
                
                if (newScale > 0.001 && newScale < 0.02) {
                    hotelModel.scale.set(newScale, newScale, newScale);
                }
            }
        }
    } else if ((hand1Pinching && !hand2Pinching) || (!hand1Pinching && hand2Pinching)) {
        // Single hand movement/rotation
        const activeHand = hand1Pinching ? hand1 : hand2;
        const pinchPos = getPinchPosition(activeHand);
        
        if (pinchPos && hotelModel && hotelModel.visible) {
            if (!activeHand.userData.previousPinchPosition) {
                activeHand.userData.previousPinchPosition = pinchPos.clone();
            } else {
                const delta = pinchPos.clone().sub(activeHand.userData.previousPinchPosition);
                
                // Move the model
                hotelModel.position.add(delta);
                
                // Rotate around model's center based on horizontal movement
                const rotationSpeed = 2;
                const rotationDelta = delta.x * rotationSpeed;
                
                // Simply rotate around the model's local Y axis (center rotation)
                hotelModel.rotateY(rotationDelta);
                
                // Update spotlight position
                updateSpotlightPosition();
                
                activeHand.userData.previousPinchPosition = pinchPos.clone();
            }
        }
    } else {
        // Reset when not pinching
        initialPinchDistance = null;
        initialScale = null;
        hand1.userData.previousPinchPosition = null;
        hand2.userData.previousPinchPosition = null;
    }
}

function isPinching(hand) {
    if (!hand.joints['index-finger-tip'] || !hand.joints['thumb-tip']) return false;
    
    const indexTip = hand.joints['index-finger-tip'];
    const thumbTip = hand.joints['thumb-tip'];
    const distance = indexTip.position.distanceTo(thumbTip.position);
    
    // More restrictive pinch detection - only thumb and index finger
    const isPinchDistance = distance < 0.03; // Stricter distance
    
    // Additional check: ensure other fingers are not all closed (not a fist)
    const middleTip = hand.joints['middle-finger-tip'];
    const ringTip = hand.joints['ring-finger-tip'];
    const pinkyTip = hand.joints['pinky-finger-tip'];
    const wrist = hand.joints['wrist'];
    
    if (middleTip && ringTip && pinkyTip && wrist) {
        // Check if other fingers are too close to wrist (indicating a fist)
        const middleDistance = middleTip.position.distanceTo(wrist.position);
        const ringDistance = ringTip.position.distanceTo(wrist.position);
        const pinkyDistance = pinkyTip.position.distanceTo(wrist.position);
        
        // If other fingers are too close to wrist, it's probably a fist
        const avgOtherFingerDistance = (middleDistance + ringDistance + pinkyDistance) / 3;
        const isFist = avgOtherFingerDistance < 0.12; // Threshold for fist detection
        
        return isPinchDistance && !isFist;
    }
    
    return isPinchDistance;
}

function getPinchPosition(hand) {
    if (!hand.joints['index-finger-tip'] || !hand.joints['thumb-tip']) return null;
    
    const indexTip = hand.joints['index-finger-tip'];
    const thumbTip = hand.joints['thumb-tip'];
    
    const pinchPos = new THREE.Vector3();
    pinchPos.addVectors(indexTip.position, thumbTip.position).multiplyScalar(0.5);
    
    return pinchPos;
}

function enableDesktopPreview() {
    // Add mirror mode button
    const mirrorButton = document.createElement('button');
    mirrorButton.textContent = 'Mirror VR Session';
    mirrorButton.id = 'mirrorButton';
    mirrorButton.style.cssText = `
        background-color: #FF6B35;
        border: none;
        color: white;
        padding: 15px 32px;
        text-align: center;
        text-decoration: none;
        display: inline-block;
        font-size: 16px;
        margin: 4px 2px;
        cursor: pointer;
        border-radius: 4px;
        margin-right: 10px;
    `;
    
    startButton.textContent = 'Preview Model';
    startButton.style.display = 'inline-block';
    startButton.parentNode.insertBefore(mirrorButton, startButton);
    
    // Update status to show both options
    const currentStatus = statusElement.textContent;
    statusElement.textContent = currentStatus + ' | Desktop: Preview model or mirror VR session.';
    
    // Preview mode
    startButton.addEventListener('click', () => {
        if (!hotelModel.visible && !mirrorMode) {
            hotelModel.position.set(0, 0, -1);
            hotelModel.visible = true;
            
            // Enable spotlight for desktop preview
            modelSpotlight.visible = true;
            lightController.visible = true;
            lightController.userData.lightLine.visible = true;
            updateSpotlightPosition();
            
            startButton.style.display = 'none';
            mirrorButton.style.display = 'none';
            statusElement.textContent = 'Desktop preview: Use mouse to rotate, scroll to zoom.';
            addMouseControls();
        }
    });
    
    // Mirror mode
    mirrorButton.addEventListener('click', () => {
        enableMirrorMode();
    });
}

function enableMirrorMode() {
    mirrorMode = true;
    document.getElementById('mirrorButton').style.display = 'none';
    startButton.style.display = 'none';
    statusElement.textContent = 'Mirror mode: Waiting for VR session data...';
    
    // Start listening for VR session data
    startMirrorListener();
    
    // Set up mirror view
    camera.position.set(0, 1, 2);
    camera.lookAt(0, 0, 0);
    
    // Add visual indicator that we're in mirror mode
    const mirrorIndicator = document.createElement('div');
    mirrorIndicator.id = 'mirrorIndicator';
    mirrorIndicator.innerHTML = '📺 MIRROR MODE - Showing VR Session';
    mirrorIndicator.style.cssText = `
        position: absolute;
        top: 50px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 107, 53, 0.9);
        color: white;
        padding: 10px 20px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: bold;
        z-index: 200;
    `;
    document.body.appendChild(mirrorIndicator);
}

function addMouseControls() {
    let isMouseDown = false;
    let mouseX = 0;
    let mouseY = 0;
    
    renderer.domElement.addEventListener('mousedown', (event) => {
        isMouseDown = true;
        mouseX = event.clientX;
        mouseY = event.clientY;
    });
    
    renderer.domElement.addEventListener('mousemove', (event) => {
        if (!isMouseDown || !hotelModel.visible) return;
        
        const deltaX = event.clientX - mouseX;
        const deltaY = event.clientY - mouseY;
        
        // Rotate model based on mouse movement
        hotelModel.rotation.y += deltaX * 0.01;
        hotelModel.rotation.x += deltaY * 0.01;
        
        mouseX = event.clientX;
        mouseY = event.clientY;
    });
    
    renderer.domElement.addEventListener('mouseup', () => {
        isMouseDown = false;
    });
    
    renderer.domElement.addEventListener('wheel', (event) => {
        if (!hotelModel.visible) return;
        
        event.preventDefault();
        const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1;
        const newScale = hotelModel.scale.x * scaleFactor;
        
        if (newScale > 0.001 && newScale < 0.02) {
            hotelModel.scale.set(newScale, newScale, newScale);
        }
    });
}

function startMirrorListener() {
    // Use localStorage to share data between VR and desktop sessions
    const checkForVRData = () => {
        const vrData = localStorage.getItem('vrSessionData');
        if (vrData) {
            try {
                const data = JSON.parse(vrData);
                updateMirrorFromVRData(data);
            } catch (e) {
                console.error('Error parsing VR data:', e);
            }
        }
    };
    
    // Check for VR data every 50ms for smooth updates
    setInterval(checkForVRData, 50);
    
    // Also listen for storage events (when another tab updates the data)
    window.addEventListener('storage', (e) => {
        if (e.key === 'vrSessionData' && e.newValue) {
            try {
                const data = JSON.parse(e.newValue);
                updateMirrorFromVRData(data);
            } catch (error) {
                console.error('Error parsing VR data from storage event:', error);
            }
        }
    });
}

function updateMirrorFromVRData(data) {
    if (!hotelModel) return;
    
    // Update model visibility
    if (data.modelVisible && !hotelModel.visible) {
        hotelModel.visible = true;
        statusElement.textContent = 'Mirror mode: Showing live VR session';
    }
    
    // Update model position, rotation, and scale
    if (data.modelVisible) {
        hotelModel.position.set(data.position.x, data.position.y, data.position.z);
        hotelModel.rotation.set(data.rotation.x, data.rotation.y, data.rotation.z);
        hotelModel.scale.set(data.scale.x, data.scale.y, data.scale.z);
    }
    
    // Update status if provided
    if (data.status) {
        statusElement.textContent = `Mirror: ${data.status}`;
    }
}

function broadcastVRData() {
    if (!renderer.xr.isPresenting) return;
    
    const vrData = {
        modelVisible: hotelModel ? hotelModel.visible : false,
        position: hotelModel ? hotelModel.position : { x: 0, y: 0, z: 0 },
        rotation: hotelModel ? hotelModel.rotation : { x: 0, y: 0, z: 0 },
        scale: hotelModel ? hotelModel.scale : { x: 1, y: 1, z: 1 },
        timestamp: Date.now()
    };
    
    try {
        localStorage.setItem('vrSessionData', JSON.stringify(vrData));
    } catch (e) {
        console.error('Error broadcasting VR data:', e);
    }
}

function updateSpotlightPosition() {
    if (!hotelModel || !modelSpotlight) return;
    
    // Position spotlight above the model
    const modelHeight = 0.5; // Adjust based on your model's height
    modelSpotlight.position.copy(hotelModel.position);
    modelSpotlight.position.y += modelHeight;
    
    // Point spotlight at the model
    modelSpotlight.target.position.copy(hotelModel.position);
    modelSpotlight.target.updateMatrixWorld();
    
    // Scale spotlight distance with model scale
    const baseDistance = 10;
    modelSpotlight.distance = baseDistance * hotelModel.scale.x / 0.005;
    
    // Update light controller position
    if (lightController && !lightControllerSelected) {
        lightController.position.copy(modelSpotlight.position);
        updateLightLine();
    }
}

function updateSpotlightFromController() {
    if (!lightController || !modelSpotlight || !hotelModel) return;
    
    // Update spotlight position from controller
    modelSpotlight.position.copy(lightController.position);
    
    // Point spotlight at the model
    modelSpotlight.target.position.copy(hotelModel.position);
    modelSpotlight.target.updateMatrixWorld();
    
    // Update the visual line
    updateLightLine();
}

function updateLightLine() {
    if (!lightController || !hotelModel) return;
    
    const line = lightController.userData.lightLine;
    const positions = new Float32Array(6);
    
    // Line from light controller to model
    positions[0] = lightController.position.x;
    positions[1] = lightController.position.y;
    positions[2] = lightController.position.z;
    positions[3] = hotelModel.position.x;
    positions[4] = hotelModel.position.y;
    positions[5] = hotelModel.position.z;
    
    line.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    line.geometry.attributes.position.needsUpdate = true;
}