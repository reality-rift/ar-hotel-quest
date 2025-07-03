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
    loader.load('./HotelB_AR.glb', function (gltf) {
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
            } else {
                statusElement.textContent = 'AR not supported on this device.';
            }
        });
    } else {
        statusElement.textContent = 'WebXR not available in this browser.';
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
        statusElement.textContent = 'Model placed. One hand: move/rotate. Two hands: scale.';
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
    }

    renderer.render(scene, camera);
}

function updateHandInteraction(hand) {
    // Check if both hands are pinching
    const hand1Pinching = isPinching(hand1);
    const hand2Pinching = isPinching(hand2);
    
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
                
                // Rotate based on horizontal movement
                const rotationSpeed = 2;
                hotelModel.rotation.y += delta.x * rotationSpeed;
                
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
    
    return distance < 0.05;
}

function getPinchPosition(hand) {
    if (!hand.joints['index-finger-tip'] || !hand.joints['thumb-tip']) return null;
    
    const indexTip = hand.joints['index-finger-tip'];
    const thumbTip = hand.joints['thumb-tip'];
    
    const pinchPos = new THREE.Vector3();
    pinchPos.addVectors(indexTip.position, thumbTip.position).multiplyScalar(0.5);
    
    return pinchPos;
}