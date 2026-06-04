/*
----- Coding Tutorial by Patt Vira ----- 
Name: Valentine's Day Specials 2025 with ml5.js
Video Tutorial: https://youtu.be/7eogDirFdGI

Connect with Patt: @pattvira
https://www.pattvira.com/
----------------------------------------
*/

let handPose;
let video;
let hands = [];
let options = {flipped: true};
let leftHand, rightHand;

let pts = []; let heartColor = 255;
let hearts = []; let heartCreated = false;
let colorPalette = ["#70d6ff","#ff70a6","#ff9770","#ffd670","#e9ff70"];

function preload() {
  handPose = ml5.handPose(options);
}

function setup() {
  createCanvas(640, 480);
  video = createCapture(VIDEO, options);
  video.size(640, 480);
  video.hide();
  handPose.detectStart(video, gotHands);
}

function draw() {
  image(video, 0, 0, width, height);
  trackHandPosition();
  
  fill(heartColor);
  noStroke();
  beginShape();
  for (let i=0; i<pts.length; i++) {
    if (pts[i]) {
      vertex(pts[i].x, pts[i].y);
    } 
  }
  endShape(CLOSE);
  
  checkForHeart();
  
  for (let i=0; i<hearts.length; i++) {
    hearts[i].update();
    if (hearts[i].done == true) {
      hearts.splice(i, 1);
    }
  }
  
  for (let i=0; i<hearts.length; i++) {
    hearts[i].display();
  }
}

function trackHandPosition() {
  let updatedPts = [];
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i]; 
    let handedness = hand.handedness;
    let keypoints = hand.keypoints;
    
    if (handedness == "Left") {
      updatedPts[0] = keypoints[4];
      updatedPts[1] = keypoints[3];
      updatedPts[2] = keypoints[2];
      updatedPts[3] = keypoints[5];
      updatedPts[4] = keypoints[6];
      updatedPts[5] = keypoints[7];
      updatedPts[6] = keypoints[8];
    }
    
    if (handedness == "Right") {
      updatedPts[7] = keypoints[8];
      updatedPts[8] = keypoints[7];
      updatedPts[9] = keypoints[6];
      updatedPts[10] = keypoints[5];
      updatedPts[11] = keypoints[2];
      updatedPts[12] = keypoints[3];
      updatedPts[13] = keypoints[4];
    }  
  }
  pts = updatedPts;
}

function checkForHeart() {
  let leftThumb = pts[0];
  let rightThumb = pts[13];
  let leftIndex = pts[6];
  let rightIndex = pts[7];
  
  if (leftThumb && rightThumb && leftIndex && rightIndex) {
    let thumbDist = dist(rightThumb.x, rightThumb.y, leftThumb.x, leftThumb.y);
    let indexDist = dist(rightIndex.x, rightIndex.y, leftIndex.x, leftIndex.y);
    
    if(thumbDist < 20 && indexDist < 20 && !heartCreated) {
      hearts.push(new Heart(pts));
      heartCreated = true;
    } else if (thumbDist > 30 || indexDist > 30) {
      heartCreated = false;
    }
  }
}

function gotHands(results) {
  hands = results;
}
