var split = false;
var stageLoaded = false;
var movesReceived = 0;
var currentLevel = 1;

function setSplit(value) {
    split = !!value;
}

function setStageLoaded(value) {
    stageLoaded = value;
}

function updateMovesReceived() {
    movesReceived++;
}

function LogFrame(frame) {
    // initial drop
    if (frame === 223) {
        setStageLoaded(1);
    }
    // final drop
    if (frame === 366) {
        setStageLoaded(0);
        // Timer ends on completing the last stage for the category
        if (typeof AddStageByLevel === "function") {
            AddStageByLevel(typeof currentLevel !== "undefined" ? currentLevel : 1);
        }
    }
    // splitting
    if (!split && (frame === 367 || frame === 521)) {
        setSplit(1);
    }
}
