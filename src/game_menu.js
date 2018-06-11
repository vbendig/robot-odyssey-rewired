import './game_menu.css'

export const States = {
    SPLASH: 0,
    MENU: 1,
    EXEC: 2,
    LOADING: 3,
    ERROR: 4,
};

const MENU_CHOICES = [
    [ "show.exe", "" ],     // Robotropolis (via opening cutscene)
    [ "lab.exe", "30" ],    // Innovation Lab
    [ "tut.exe", "21" ],    // Tutorial 1
    [ "tut.exe", "22" ],    // Tutorial 2
    [ "tut.exe", "23" ],    // Tutorial 3
    [ "tut.exe", "24" ],    // Tutorial 4
    [ "tut.exe", "25" ],    // Tutorial 5
    [ "tut.exe", "26" ],    // Tutorial 5
    [ "lab.exe", "27" ],    // Tutorial 7 (via LAB.EXE)
];

const splash = document.getElementById('splash');
const game_menu_cursor = document.getElementById('game_menu_cursor');

var current_state = States.S_SPLASH;
var current_menu_choice = 0;
var menu_joystick_interval = null;
var menu_joystick_y = 0;

export function showError(err)
{
    setState(States.S_ERROR);
    const el = document.getElementById("error");

    err = err.toString();
    if (err.includes("no binaryen method succeeded")) {
        // This is obtuse; we only build for wasm, so really this means the device doesn't support wasm
        err = "No WebAssembly?\n\nSorry, this browser might not be supported.";
    } else {
        // Something else went wrong.
        err = "Fail.\n\n" + err;
    }

    el.innerText = err;
    el.style.display = "block";
}

export function init(engine)
{
    // Splashscreen pointing events
    splash.addEventListener('mousedown', function () {
        if (current_state == States.SPLASH) {
            setState(States.MENU);
        }
    });
    splash.addEventListener('touchstart', function () {
        if (current_state == States.SPLASH) {
            setState(States.MENU);
        }
    });

    // Splash animation end
    getLastSplashImage().addEventListener('animationend', function () {
        setTimeout(function () {
            if (current_state == States.SPLASH) {
                setState(States.MENU);
            }
        }, 2000);
    });

    engine.onProcessExit = function () {
        setState(States.MENU);
    };

    engine.onProcessExec = function () {
        setState(States.EXEC);
    };

    setState(States.SPLASH);
}

export function pressKey(engine, ascii, scancode)
{
    if (current_state == States.SPLASH) {
        setState(States.MENU);

    } else if (current_state == States.MENU) {

        if (scancode == 0x50 || ascii == 0x20) {
            // Down or Space
            setMenuChoice(current_menu_choice + 1);
        } else if (scancode == 0x48) {
            // Up
            setMenuChoice(current_menu_choice - 1);
        } else if (ascii == 0x0D) {
            // Enter
            execMenuChoice(engine);
        }
    }
}

export function setJoystickAxes(engine, x, y)
{
    // Timed movements, according to Y axis.
    // This installs an interval handler if needed, which stays installed
    // until we change game_menu states.

    const interval = 100;
    const speed = 1 / 32.0;

    menu_joystick_y = y;
    if (!menu_joystick_interval) {
        var accumulator = 0;

        menu_joystick_interval = setInterval(function () {
            accumulator += menu_joystick_y * speed;
            if (accumulator > 1) {
                accumulator = Math.min(accumulator - 1, 1);
                setMenuChoice(current_menu_choice + 1);
            } else if (accumulator < -1) {
                accumulator = Math.max(accumulator + 1, -1);
                setMenuChoice(current_menu_choice - 1);
            }
        }, interval);
    }
}

export function setJoystickButton(engine, b)
{
    if (b && current_state == States.SPLASH) {
        setState(States.MENU);
    } else if (b && current_state == States.MENU) {
        execMenuChoice(engine);
    }
}

export function afterLoading(engine, func)
{
    if (engine.calledRun) {
        // Already loaded
        func();
    } else {
        setState(States.LOADING);
        engine.then(func);
    }
}

function getLastSplashImage()
{
    var result = null;
    for (let child of splash.children) {
        if (child.nodeName == 'IMG') {
            result = child;
        }
    }
    return result;
}

function setVisibility(element_id, vis)
{
    const element = document.getElementById(element_id);
    if (vis) {
        element.classList.remove("hidden");
    } else {
        element.classList.add("hidden");
    }
}

export function setState(s)
{
    if (s == current_state) {
        return;
    }
    current_state = s;

    if (menu_joystick_interval) {
        clearInterval(menu_joystick_interval);
        menu_joystick_interval = null;
    }

    setVisibility('splash', s == States.SPLASH || s == States.MENU || s == States.EXEC);
    setVisibility('game_menu', s == States.MENU || s == States.EXEC);
    setVisibility('loading', s == States.LOADING || s == States.EXEC);
    setVisibility('framebuffer', s == States.EXEC);
    setVisibility('error', s == States.ERROR);

    // Keep the underlying objects visible during EXEC so they stay behind the iris transition;
    // but eventually hide them, both to reset the animations for later and possibly for performance.
    if (s == States.EXEC) {
        setTimeout(function () {
            if (current_state == States.EXEC) {
                setVisibility('splash', false);
                setVisibility('game_menu', false);
                setVisibility('loading', false);
            }
        }, 2000);
    }
}

function setMenuChoice(c)
{
    c %= MENU_CHOICES.length;
    while (c < 0) c += MENU_CHOICES.length;

    if (c != current_menu_choice) {
        current_menu_choice = c;
    }

    var pixel_top = current_menu_choice * 15;
    if (current_menu_choice >= 2) pixel_top += 16;

    game_menu_cursor.style.top = (pixel_top * 100 / 192) + '%';
}

function execMenuChoice(engine)
{
    const choice = MENU_CHOICES[current_menu_choice];
    afterLoading(engine, function () {
        engine.exec.apply(engine, choice);
    });
}
