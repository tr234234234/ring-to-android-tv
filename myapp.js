"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
exports.__esModule = true;
require("dotenv/config");
var ring_client_api_1 = require("ring-client-api");
var util_1 = require("util");
var jimp_1 = __importDefault(require("jimp"));
var fs = require('fs'), path = require('path'), http = require('http'), url = require('url'), request = require('request'), findRemoveSync = require('find-remove');
var PORT = process.env.RING_PORT;
var CAMERA_NAME = process.env.CAMERA_NAME;
var tvIpAddress = process.env.R2ATV_IP_ADDRESS; // IP address of the Android TV you are running PiPup on
var displayTime = process.env.R2ATV_DISPLAY_TIME || 12; // Display time for notifications, in seconds
var sendDingNotification = process.env.SEND_DING_NOTIFICTION || true;
var sendMotionNotification = process.env.SEND_MOTION_NOTIFICAION || true;
var sendLiveSteamNotification = process.env.SEND_LIVESTREAM_NOTIFICATION || true;
var SUPERVISOR_TOKEN = process.env.SUPERVISOR_TOKEN;
var chosenCamera = CAMERA_NAME;
var ringApi;
var camera;
var publicOutputDirectory;
var server;
var lastImageFileName = "error.png";
function getCamera() {
    return __awaiter(this, void 0, void 0, function () {
        var cameras, camera, i, cameraName;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ringApi.getCameras()];
                case 1:
                    cameras = _a.sent();
                    //
                    if (chosenCamera) {
                        for (i = 0; i < cameras.length; i++) {
                            cameraName = cameras[i].name;
                            console.log("Checking If " + cameraName + " Is the same as the camera we are looking for (" + chosenCamera + ")");
                            if (chosenCamera == cameraName) {
                                camera = cameras[i];
                                console.log("Matched " + cameraName);
                            }
                        }
                    }
                    else {
                        camera = cameras[0];
                    }
                    //
                    if (!cameras) {
                        console.log('No cameras found');
                        return [2 /*return*/];
                    }
                    //
                    return [2 /*return*/, camera];
            }
        });
    });
}
function connectToRing() {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            ringApi = new ring_client_api_1.RingApi({
                // Refresh token is used when 2fa is on
                refreshToken: process.env.RING_REFRESH_TOKEN,
                controlCenterDisplayName: 'my-ring-to-android-tv',
                cameraDingsPollingSeconds: 5
            });
            console.log('Connected to Ring API');
            // Automatically replace refresh tokens, as they now expire after each use.
            // See: https://github.com/dgreif/ring/wiki/Refresh-Tokens#refresh-token-expiration
            ringApi.onRefreshTokenUpdated.subscribe(function (_a) {
                var newRefreshToken = _a.newRefreshToken, oldRefreshToken = _a.oldRefreshToken;
                return __awaiter(_this, void 0, void 0, function () {
                    var currentConfig, updatedConfig;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                console.log('Refresh Token Updated'); // Changed from example, don't write new token to log.
                                if (!oldRefreshToken) {
                                    return [2 /*return*/];
                                }
                                return [4 /*yield*/, util_1.promisify(fs.readFile)('/data/options.json')];
                            case 1:
                                currentConfig = _b.sent(), updatedConfig = currentConfig
                                    .toString()
                                    .replace(oldRefreshToken, newRefreshToken);
                                return [4 /*yield*/, util_1.promisify(fs.writeFile)('/data/options.json', updatedConfig)];
                            case 2:
                                _b.sent();
                                return [2 /*return*/];
                        }
                    });
                });
            });
            return [2 /*return*/];
        });
    });
}
function timeStamp() {
    // Create a date object with the current time
    var now = new Date();
    var dateYearStr = now.getFullYear().toString();
    var dateMonthStr;
    var monthNum = now.getMonth() + 1;
    if (monthNum < 10) {
        dateMonthStr = "0" + monthNum.toString();
    }
    else {
        dateMonthStr = monthNum.toString();
    }
    var dateDayStr;
    if (now.getDate() < 10) {
        dateDayStr = "0" + now.getDate().toString();
    }
    else {
        dateDayStr = now.getDate().toString();
    }
    var dateHoursStr;
    if (now.getHours() < 10) {
        dateHoursStr = "0" + now.getHours().toString();
    }
    else {
        dateHoursStr = now.getHours().toString();
    }
    var dateMinutesStr;
    if (now.getMinutes() < 10) {
        dateMinutesStr = "0" + now.getMinutes().toString();
    }
    else {
        dateMinutesStr = now.getMinutes().toString();
    }
    var dateSecondsStr;
    if (now.getSeconds() < 10) {
        dateSecondsStr = "0" + now.getSeconds().toString();
    }
    else {
        dateSecondsStr = now.getSeconds().toString();
    }
    // Return the formatted string
    return dateYearStr + "-" + dateMonthStr + "-" + dateDayStr + "_" + dateHoursStr + "-" + dateMinutesStr + "-" + dateSecondsStr;
}
function getApiStatus() {
    return __awaiter(this, void 0, void 0, function () {
        var options;
        return __generator(this, function (_a) {
            options = {
                method: "GET",
                url: "http://supervisor/core/api/discovery_info",
                headers: {
                    "Authorization": "Bearer " + SUPERVISOR_TOKEN,
                    "content-type": 'application/json'
                }
            };
            console.log('Getting API status...');
            request(options, function (err, res, body) {
                if (err) {
                    console.log("[ERROR] Error getting status: ");
                    console.log(err);
                }
                else {
                    console.log("Sent notification successfully: " + body);
                }
            });
            return [2 /*return*/];
        });
    });
}
function postMotionEvent() {
    return __awaiter(this, void 0, void 0, function () {
        var options;
        return __generator(this, function (_a) {
            options = {
                method: "POST",
                url: "http://supervisor/core/api/services/script/turn_on",
                headers: {
                    "Authorization": "Bearer " + SUPERVISOR_TOKEN,
                    "content-type": 'application/json'
                },
                json: {
                    "entity_id": "script.front_door_motion_event"
                }
            };
            console.log('Sending front door motion event...');
            request(options, function (err, res, body) {
                if (err) {
                    console.log("[ERROR] Error sending front door motion event: ");
                    console.log(err);
                }
                else {
                    console.log("Sent front door motion event: " + body);
                }
            });
            return [2 /*return*/];
        });
    });
}
function postDoorbellEvent() {
    return __awaiter(this, void 0, void 0, function () {
        var options;
        return __generator(this, function (_a) {
            options = {
                method: "POST",
                url: "http://supervisor/core/api/services/script/turn_on",
                headers: {
                    "Authorization": "Bearer " + SUPERVISOR_TOKEN,
                    "content-type": 'application/json'
                },
                json: {
                    "entity_id": "script.front_door_doorbell_event"
                }
            };
            console.log('Sending front door doorbell event...');
            request(options, function (err, res, body) {
                if (err) {
                    console.log("[ERROR] Error sending front door doorbell event: ");
                    console.log(err);
                }
                else {
                    console.log("Sent front door doorbell event: " + body);
                }
            });
            return [2 /*return*/];
        });
    });
}
/**
 * Sends a notification to PiPup app on Android TV.
 * @param {*} title Title of notification message.
 * @param {*} message Text of notification message.
 * @param {*} imageFile Path to image file, can be blank string to display no image.
 * @param {*} exitAfter If true, calls process.exit() after completing request.
 */
function sendNotification(title, message, imageFile, exitAfter) {
    if (exitAfter === void 0) { exitAfter = false; }
    return __awaiter(this, void 0, void 0, function () {
        var options;
        return __generator(this, function (_a) {
            options = {
                method: "POST",
                url: "http://" + tvIpAddress + ":7979/notify",
                port: 7979,
                headers: {
                    "Content-Type": "multipart/form-data"
                },
                formData: {
                    "duration": displayTime,
                    "position": 0,
                    "title": title,
                    "titleColor": "#0066cc",
                    "titleSize": 20,
                    "message": message,
                    "messageColor": "#000000",
                    "messageSize": 14,
                    "backgroundColor": "#ffffff",
                    "image": (imageFile == '') ? "" : fs.createReadStream(__dirname + '/' + publicOutputDirectory + '/' + imageFile),
                    "imageWidth": 640
                }
            };
            // Fire off POST message to PiPup with 'request'
            request(options, function (err, res, body) {
                if (err) {
                    console.log("[ERROR] Error sending notification: " + title + " - " + message);
                    console.log(err);
                    process.exitCode = 1;
                }
                else {
                    console.log("Sent notification successfully: " + title + " - " + message);
                }
                if (exitAfter)
                    process.exit();
            });
            return [2 /*return*/];
        });
    });
}
/**
 * Starts polling a Ring camera for events and grabs snapshots on motion/dings.
 * @param {*} notifyOnStart Whether to send a notification when beginning camera polling.
 */
function startCameraPolling(notifyOnStart) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            console.log("\t - Found " + camera.model + " named " + camera.name + ".");
            // Start the camera subscription to listen for motion/rings/etc...
            camera.onNewDing.subscribe(function (ding) { return __awaiter(_this, void 0, void 0, function () {
                var event, notifyTitle, notifyMessage, time, filename, snapshotBuffer, e_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            event = "Unknown Event";
                            // Get friendly name for event happening and set notification params.
                            switch (ding.kind) {
                                case "motion":
                                    event = "Motion detected";
                                    notifyTitle = 'Motion Detected';
                                    notifyMessage = "Motion detected at " + camera.name + "!";
                                    break;
                                case "ding":
                                    event = "Doorbell pressed";
                                    notifyTitle = 'Doorbell Ring';
                                    notifyMessage = "Doorbell rung at " + camera.name + "!";
                                    break;
                                default:
                                    event = "Video started (" + ding.kind + ")";
                                    notifyTitle = 'Video Started';
                                    notifyMessage = "Video started at " + camera.name;
                            }
                            time = timeStamp();
                            console.log("[" + time + "] " + event + " on " + camera.name + " camera.");
                            filename = time + "_frontdoor.png";
                            lastImageFileName = filename;
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, camera.getSnapshot()["catch"](function (error) {
                                    console.log('[ERROR] Unable to retrieve snapshot because:' + error.message);
                                })
                                //add text to image
                            ];
                        case 2:
                            snapshotBuffer = _a.sent();
                            //add text to image
                            jimp_1["default"].read(snapshotBuffer).then(function (image) {
                                // success case, the file was saved
                                var today = new Date();
                                ' ';
                                var time = today.toLocaleString('en-US');
                                jimp_1["default"].loadFont(jimp_1["default"].FONT_SANS_16_WHITE).then(function (font) {
                                    image.print(font, 10, 1, "" + time);
                                    image.getBuffer(jimp_1["default"].MIME_PNG, function (err, imageBuffer) {
                                        fs.writeFile(__dirname + '/' + publicOutputDirectory + '/' + filename, imageBuffer, function (err) {
                                            // throws an error, you could also catch it here
                                            if (err)
                                                throw err;
                                            // success case, the file was saved
                                            console.log('Snapshot saved! ' + filename);
                                            // Get friendly name for event happening and set notification params.
                                            switch (ding.kind) {
                                                case "motion":
                                                    if (sendMotionNotification)
                                                        sendNotification(notifyTitle, notifyMessage, filename);
                                                    postMotionEvent();
                                                    break;
                                                case "ding":
                                                    if (sendDingNotification)
                                                        sendNotification(notifyTitle, notifyMessage, filename);
                                                    postDoorbellEvent();
                                                    break;
                                                default:
                                                    if (sendLiveSteamNotification)
                                                        sendNotification(notifyTitle, notifyMessage, filename);
                                            }
                                            //fs.copyFile(filename, "snapshot.png", (err) => {
                                            //    if (err) {
                                            //              console.log("Error Found:", err);
                                            //    }
                                            //});
                                        });
                                    });
                                });
                            });
                            return [3 /*break*/, 4];
                        case 3:
                            e_1 = _a.sent();
                            // Failed to retrieve snapshot. We send text of notification along with error image.
                            // Most common errors are due to expired API token, or battery-powered camera taking too long to wake.
                            console.log('Unable to get snapshot.');
                            sendNotification(notifyTitle, notifyMessage, 'error.png');
                            return [3 /*break*/, 4];
                        case 4:
                            console.log('');
                            return [2 /*return*/];
                    }
                });
            }); }, function (err) {
                console.log("Error subscribing to " + camera.name + ":");
                console.log(err);
            });
            // Send notification on app start, if enabled.
            if (notifyOnStart)
                sendNotification('ring-to-android-tv', 'Ring notifications started!', '');
            return [2 /*return*/];
        });
    });
}
function startHttpServer() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            server = http.createServer(function (req, res) {
                return __awaiter(this, void 0, void 0, function () {
                    var uri, snapshotBuffer, e_2, filename;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                uri = url.parse(req.url).pathname;
                                console.log('requested uri: ' + uri);
                                // If Accessing The Main Page
                                if (uri == '/index.html' || uri == '/') {
                                    res.writeHead(200, { 'Content-Type': 'text/html' });
                                    res.write('<html><head><title>Ring Monitor</title></head><body>');
                                    res.write('<h1>Welcome to your Ring Monitor!</h1>');
                                    res.write("<image width=\"352\" height=\"198\" src=\"snapshot.png\"></image>");
                                    res.end();
                                    return [2 /*return*/];
                                }
                                if (uri == '/lastmotion') {
                                    filename = lastImageFileName;
                                    fs.exists(publicOutputDirectory + '/' + filename, function (exists) {
                                        return __awaiter(this, void 0, void 0, function () {
                                            var stream;
                                            return __generator(this, function (_a) {
                                                if (!exists) {
                                                    console.log('file not found: ' + filename);
                                                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                                                    res.write("file not found: " + filename + "\n");
                                                    res.end();
                                                }
                                                else {
                                                    console.log('sending file: ' + filename);
                                                    res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Disposition': "inline; filename=" + filename });
                                                    stream = fs.createReadStream(publicOutputDirectory + '/' + filename, { bufferSize: 64 * 1024 });
                                                    stream.pipe(res);
                                                }
                                                return [2 /*return*/];
                                            });
                                        });
                                    });
                                    return [2 /*return*/];
                                }
                                if (!(uri == '/currentimage')) return [3 /*break*/, 5];
                                _a.label = 1;
                            case 1:
                                _a.trys.push([1, 3, , 4]);
                                return [4 /*yield*/, camera.getSnapshot()["catch"](function (error) {
                                        console.log('[ERROR] Unable to retrieve snapshot because:' + error.message);
                                    })
                                    //add text to image
                                ];
                            case 2:
                                snapshotBuffer = _a.sent();
                                //add text to image
                                jimp_1["default"].read(snapshotBuffer)
                                    .then(function (image) {
                                    // success case, the file was saved
                                    var today = new Date();
                                    ' ';
                                    var time = today.toLocaleString('en-US');
                                    jimp_1["default"].loadFont(jimp_1["default"].FONT_SANS_16_WHITE).then(function (font) {
                                        image.print(font, 10, 1, "" + time);
                                        image.getBuffer(jimp_1["default"].MIME_PNG, function (err, imageBuffer) {
                                            res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Disposition': "inline; filename=currentimage.png" });
                                            res.write(imageBuffer);
                                            res.end();
                                        });
                                    });
                                })["catch"](function (err) {
                                    // Handle an exception.
                                    console.log('Cound not add text to image:' + err.message);
                                });
                                return [3 /*break*/, 4];
                            case 3:
                                e_2 = _a.sent();
                                // Failed to retrieve snapshot. We send text of notification along with error image.
                                // Most common errors are due to expired API token, or battery-powered camera taking too long to wake.
                                console.log('Unable to get snapshot.');
                                //console.log(e)
                                console.error(e_2.name + ': ' + e_2.message);
                                res.writeHead(404, { 'Content-Type': 'text/plain' });
                                res.write("Unable to get snapshot.\n");
                                res.end();
                                return [3 /*break*/, 4];
                            case 4: return [2 /*return*/];
                            case 5:
                                filename = path.join("./", uri);
                                console.log('mapped filename: ' + filename);
                                fs.exists(filename, function (exists) {
                                    return __awaiter(this, void 0, void 0, function () {
                                        var stream;
                                        return __generator(this, function (_a) {
                                            if (!exists) {
                                                console.log('file not found: ' + filename);
                                                res.writeHead(404, { 'Content-Type': 'text/plain' });
                                                res.write('file not found: %s\n', filename);
                                                res.end();
                                            }
                                            else {
                                                console.log('sending file: ' + filename);
                                                switch (path.extname(uri)) {
                                                    case '.png':
                                                        res.writeHead(200, { 'Content-Type': 'image/png' });
                                                        stream = fs.createReadStream(filename, { bufferSize: 64 * 1024 });
                                                        stream.pipe(res);
                                                        break;
                                                    default:
                                                        console.log('unknown file type: ' + path.extname(uri));
                                                        res.writeHead(500);
                                                        res.end();
                                                }
                                            }
                                            return [2 /*return*/];
                                        });
                                    });
                                });
                                return [2 /*return*/];
                        }
                    });
                });
            }).listen(PORT);
            console.log('Started server, listening on port ' + PORT + '.');
            return [2 /*return*/];
        });
    });
}
function runMain() {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(!('RING_REFRESH_TOKEN' in process.env) || !('RING_PORT' in process.env) || !('CAMERA_NAME' in process.env))) return [3 /*break*/, 1];
                    console.log('Missing environment variables. Check RING_REFRESH_TOKEN, RING_PORT and CAMERA_NAME are set.');
                    process.exit();
                    return [3 /*break*/, 8];
                case 1: return [4 /*yield*/, connectToRing()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, getCamera()];
                case 3:
                    camera = _a.sent();
                    publicOutputDirectory = path.join('public/');
                    console.log('output directory: ' + publicOutputDirectory);
                    return [4 /*yield*/, util_1.promisify(fs.exists)(publicOutputDirectory)];
                case 4:
                    if (!!(_a.sent())) return [3 /*break*/, 6];
                    return [4 /*yield*/, util_1.promisify(fs.mkdir)(publicOutputDirectory)];
                case 5:
                    _a.sent();
                    _a.label = 6;
                case 6:
                    result = findRemoveSync(__dirname + '/' + publicOutputDirectory, { extensions: ['.png'], ignore: 'err.png' });
                    console.log('Deleted the files: ' + result);
                    return [4 /*yield*/, startHttpServer()];
                case 7:
                    _a.sent();
                    startCameraPolling(true);
                    _a.label = 8;
                case 8: return [2 /*return*/];
            }
        });
    });
}
runMain();
