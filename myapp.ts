import { log } from 'console';
import 'dotenv/config'
import { RingApi, RingCamera } from 'ring-client-api'
import { promisify} from 'util'
import Jimp from 'jimp';

const fs = require('fs'),
  path = require('path'),
  http = require('http'),
  url = require('url'),
  request = require('request'),
  findRemoveSync = require('find-remove'),
  schedule = require('node-schedule');
 
const PORT = process.env.RING_PORT;
const CAMERA_NAME = process.env.CAMERA_NAME;
const tvIpAddress = process.env.R2ATV_IP_ADDRESS            // IP address of the Android TV you are running PiPup on
const displayTime = process.env.R2ATV_DISPLAY_TIME || 12    // Display time for notifications, in seconds
const sendDingNotification =  process.env.SEND_DING_NOTIFICTION || true
const sendMotionNotification = process.env.SEND_MOTION_NOTIFICAION || true
const sendLiveSteamNotification =  process.env.SEND_LIVESTREAM_NOTIFICATION || true
const SUPERVISOR_TOKEN = process.env.SUPERVISOR_TOKEN;

var chosenCamera = CAMERA_NAME;

var ringApi: RingApi;
var camera: RingCamera;
var publicOutputDirectory: string;
var server: any;
var lastImageFileName = "error.png";
var eventCount = 0;
var doNotDisturb = false;

async function getCamera() {
  var cameras = await ringApi.getCameras();
  var camera: any;
  //
  if (chosenCamera) {
    for (var i=0; i < cameras.length; i++) {
      var cameraName = cameras[i].name;
      console.log(`Checking If ${cameraName} Is the same as the camera we are looking for (${chosenCamera})`);
      if (chosenCamera == cameraName) {
        camera = cameras[i];
        console.log(`Matched ${cameraName}`);
      } 
    }
  } else {
    camera = cameras[0]
  }
  //
  if (!cameras) {
    console.log('No cameras found')
    return
  }
  //
  return camera
}

async function connectToRing() {
  
  ringApi = new RingApi({
    // Refresh token is used when 2fa is on
    refreshToken: process.env.RING_REFRESH_TOKEN!,
    controlCenterDisplayName: 'my-ring-to-android-tv',
    cameraDingsPollingSeconds: 5,    // Default is 5, less seems to cause API token to expire.
    //debug: true
  })
  console.log('Connected to Ring API')

  // Automatically replace refresh tokens, as they now expire after each use.
  // See: https://github.com/dgreif/ring/wiki/Refresh-Tokens#refresh-token-expiration
  ringApi.onRefreshTokenUpdated.subscribe(
    async ({ newRefreshToken, oldRefreshToken }) => {
        console.log('Refresh Token Updated') // Changed from example, don't write new token to log.

        if (!oldRefreshToken) {
        return
        }

        const currentConfig = await promisify(fs.readFile)('/data/options.json'),
        updatedConfig = currentConfig
            .toString()
            .replace(oldRefreshToken, newRefreshToken)

        await promisify(fs.writeFile)('/data/options.json', updatedConfig)
      }
    )
}

function timeStamp() {
  // Create a date object with the current time
    var now = new Date();
  
    var dateYearStr: string = now.getFullYear().toString();
    var dateMonthStr: string;
    var monthNum: Number = now.getMonth() + 1;
    if( monthNum< 10) {
      dateMonthStr = "0" + monthNum.toString();
    } else {
      dateMonthStr = monthNum.toString();
    }
    var dateDayStr: string;
    if(now.getDate() < 10) {
      dateDayStr = "0" + now.getDate().toString();
    } else {
      dateDayStr = now.getDate().toString();
    }
    
    var dateHoursStr: string
    if(now.getHours() < 10) {
      dateHoursStr = "0" + now.getHours().toString();
    } else {
      dateHoursStr = now.getHours().toString();
    }
    var dateMinutesStr: string
    if(now.getMinutes() < 10) {
      dateMinutesStr = "0" + now.getMinutes().toString();
    } else {
      dateMinutesStr = now.getMinutes().toString();
    }
    var dateSecondsStr: string
    if(now.getSeconds() < 10) {
      dateSecondsStr = "0" + now.getSeconds().toString();
    } else {
      dateSecondsStr = now.getSeconds().toString();
    }

    // Return the formatted string
    return dateYearStr + "-" + dateMonthStr + "-" + dateDayStr + "_" + dateHoursStr + "-" + dateMinutesStr + "-" + dateSecondsStr ;
  }

async function getApiStatus() {
  const options = {
    method: "GET",
    url: "http://supervisor/core/api/discovery_info",
    headers: {
        "Authorization": `Bearer ${SUPERVISOR_TOKEN}`,
        "content-type": 'application/json'
    }
}
console.log('Getting API status...');
 request(options, function (err, res, body) {
  if(err) {
      console.log(`[ERROR] Error getting status: `)
      console.log(err)
  } else {
      console.log(`Sent notification successfully: ${body}`)
  }
})
}

async function postMotionEventNum( eventCount: number) {
  const options = {
    method: "POST",
    url: "http://supervisor/core/api/states/sensor.front_door_motion_events",
    headers: {
        "Authorization": `Bearer ${SUPERVISOR_TOKEN}`,
        "content-type": 'application/json'
    },
    json: {
      "state": `${eventCount}`
    }
}
console.log('Updateing front door motion count...');
 request(options, function (err, res, body) {
  if(err) {
      console.log(`[ERROR] Error updating front door motion event count: `)
      console.log(err)
  } else {
      console.log(`Updated front door motion event count: ${body}`)
  }
})
}

async function postMotionEvent() {
  const options = {
    method: "POST",
    url: "http://supervisor/core/api/services/script/turn_on",
    headers: {
        "Authorization": `Bearer ${SUPERVISOR_TOKEN}`,
        "content-type": 'application/json'
    },
    json: {
      "entity_id": "script.front_door_motion_event"
    }
}
console.log('Sending front door motion event...');
 request(options, function (err, res, body) {
  if(err) {
      console.log(`[ERROR] Error sending front door motion event: `)
      console.log(err)
  } else {
      console.log(`Sent front door motion event: ${body}`)
  }
})
}

async function postDoorbellEvent() {
  const options = {
    method: "POST",
    url: "http://supervisor/core/api/services/script/turn_on",
    headers: {
        "Authorization": `Bearer ${SUPERVISOR_TOKEN}`,
        "content-type": 'application/json'
    },
    json: {
      "entity_id": "script.front_door_doorbell_event"
    }
}
console.log('Sending front door doorbell event...');
 request(options, function (err, res, body) {
  if(err) {
      console.log(`[ERROR] Error sending front door doorbell event: `)
      console.log(err)
  } else {
      console.log(`Sent front door doorbell event: ${body}`)
  }
})
}


/**
 * Sends a notification to PiPup app on Android TV.
 * @param {*} title Title of notification message.
 * @param {*} message Text of notification message.
 * @param {*} imageFile Path to image file, can be blank string to display no image.
 * @param {*} exitAfter If true, calls process.exit() after completing request.
 */
 async function sendNotification(title, message, imageFile, exitAfter = false) {    
  const options = {
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
          "image" : (imageFile == '') ? "" : fs.createReadStream(__dirname + '/' + publicOutputDirectory +'/' + imageFile),
          "imageWidth": 640
      }
  }
  
  // Fire off POST message to PiPup with 'request'
  request(options, function (err, res, body) {
      if(err) {
          console.log(`[ERROR] Error sending notification: ${title} - ${message}`)
          console.log(err)
          process.exitCode = 1
      } else {
          console.log(`Sent notification successfully: ${title} - ${message}`)
      }
      if(exitAfter) process.exit()
  })
}

/**
 * Starts polling a Ring camera for events and grabs snapshots on motion/dings.
 * @param {*} notifyOnStart Whether to send a notification when beginning camera polling.
 */
async function startCameraPolling(notifyOnStart) {
  console.log(`\t - Found ${camera.model} named ${camera.name}.`)

  // Start the camera subscription to listen for motion/rings/etc...
  camera.onNewDing.subscribe(async ding => {
      var event = "Unknown Event"
      var notifyTitle;
      var notifyMessage;

      // Get friendly name for event happening and set notification params.
      switch(ding.kind) {
          case "motion":
              event = "Motion detected"
              notifyTitle = 'Motion Detected'
              notifyMessage = `Motion detected at ${camera.name}!`
              break
          case "ding":
              event = "Doorbell pressed"
              notifyTitle = 'Doorbell Ring'
              notifyMessage = `Doorbell rung at ${camera.name}!`
              break
          default:
              event = `Video started (${ding.kind})`
              notifyTitle = 'Video Started'
              notifyMessage = `Video started at ${camera.name}`
      }

      var time = timeStamp();
      console.log(`[${time}] ${event} on ${camera.name} camera.`)

      var filename =  time + "_frontdoor.png";
      lastImageFileName = filename;

      var snapshotBuffer;

      // Grab new snapshot
      try {
          snapshotBuffer = await camera.getSnapshot().catch(error => {
              console.log('[ERROR] Unable to retrieve snapshot because:' + error.message)
          })

          //add text to image
          Jimp.read(snapshotBuffer).then(image => {
              // success case, the file was saved
              var today = new Date();' '
              var time = today.toLocaleString('en-US');
              Jimp.loadFont(Jimp.FONT_SANS_16_WHITE).then(font => {
                  image.print(font, 10, 1, `${time}`);
                  image.getBuffer(Jimp.MIME_PNG, (err, imageBuffer) => {
                      fs.writeFile(__dirname + '/' + publicOutputDirectory + '/' + filename, imageBuffer, (err) => {
                          // throws an error, you could also catch it here
                          if (err) throw err;
                              
                          // success case, the file was saved
                          console.log('Snapshot saved! '+ filename);
                           // Get friendly name for event happening and set notification params.
                          switch(ding.kind) {
                            case "motion":
                              console.log("Motion Event detected.");
                              if(sendMotionNotification && !doNotDisturb) sendNotification(notifyTitle, notifyMessage, filename);
                              postMotionEvent();
                              eventCount = eventCount +1;
                              postMotionEventNum(eventCount);
                              break
                            case "ding":
                              console.log("Doorbell Event detected.");
                              if(sendDingNotification && !doNotDisturb) sendNotification(notifyTitle, notifyMessage, filename);
                              postDoorbellEvent();
                              eventCount = eventCount +1;
                              postMotionEventNum(eventCount);
                              break
                            default:
                              console.log("Live view detected.");
                              if(sendLiveSteamNotification && !doNotDisturb) sendNotification(notifyTitle, notifyMessage, filename);
                          }
                          //fs.copyFile(filename, "snapshot.png", (err) => {
                          //    if (err) {
                          //              console.log("Error Found:", err);
                          //    }
                          //});
                        })
                      });
                });
            })      
        } catch (e) {
              // Failed to retrieve snapshot. We send text of notification along with error image.
              // Most common errors are due to expired API token, or battery-powered camera taking too long to wake.
              console.log('Unable to get snapshot.')
              sendNotification(notifyTitle, notifyMessage, 'error.png')
        }

        console.log('');
  }, err => {
        console.log(`Error subscribing to ${camera.name}:`);
        console.log(err);
  });
  // Send notification on app start, if enabled.
  if(notifyOnStart) sendNotification('ring-to-android-tv', 'Ring notifications started!', '')
}

async function startHttpServer() {
    
    server = http.createServer(async function (req, res) {
      // Get URL
      var uri = url.parse(req.url).pathname;
      console.log('requested uri: '+uri)
      // If Accessing The Main Page
      if (uri == '/index.html' || uri == '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.write('<html><head><title>Ring Monitor</title></head><body>');
        res.write('<h1>Welcome to your Ring Monitor!</h1>');
        res.write(`<image width="352" height="198" src="snapshot.png"></image>`);
        res.end();
        return;
      }

      if (uri == '/lastmotion') {
        filename = lastImageFileName;
        fs.exists(publicOutputDirectory + '/' + filename, async function (exists: any) {
            if (!exists) {
              console.log('file not found: ' + filename);
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.write(`file not found: ${filename}\n`);
              res.end();
            }  else {
                console.log('sending file: ' + filename);
                res.writeHead(200, { 'Content-Type': 'image/png',
                                    'Content-Disposition': `inline; filename=${filename}` });
                var stream = fs.createReadStream(publicOutputDirectory + '/' + filename, { bufferSize: 64 * 1024 });
                stream.pipe(res);
            }
        } );
        return;
      }

      var snapshotBuffer;

      if (uri == '/currentimage') {
        // Grab new snapshot
        try {
            snapshotBuffer = await camera.getSnapshot().catch((error) => {
                console.log('[ERROR] Unable to retrieve snapshot because:' + error.message)
            })

            //add text to image
            Jimp.read(snapshotBuffer)
              .then(image => {
                // success case, the file was saved
                var today = new Date();' '
                var time = today.toLocaleString('en-US');
                Jimp.loadFont(Jimp.FONT_SANS_16_WHITE).then(font => {
                  image.print(font, 10, 1, `${time}`);
                  image.getBuffer(Jimp.MIME_PNG, (err, imageBuffer) => {
                    res.writeHead(200,{'Content-Type':'image/png',
                                       'Content-Disposition': `inline; filename=currentimage.png` });
                    res.write(imageBuffer);
                    res.end();
                  });
                  });
              })
              .catch(err => {
                // Handle an exception.
                console.log ('Cound not add text to image:'+ err.message)
              });
        } catch (e) {
            // Failed to retrieve snapshot. We send text of notification along with error image.
            // Most common errors are due to expired API token, or battery-powered camera taking too long to wake.
            console.log('Unable to get snapshot.')
            //console.log(e)
            console.error(e.name + ': ' + e.message)
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.write(`Unable to get snapshot.\n`);
            res.end();
        }
        return;
      }

      if (uri == '/deleteimages') {
        var result = findRemoveSync(__dirname + '/' +publicOutputDirectory, {extensions: ['.png'], ignore: 'error.png'});
        console.log('Deleted the files: ' + result);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.write(`Deleted files: \n` + result);
        res.end();
        return;
      }

      if (uri == '/donotdisturbon') {
        console.log('Do not disturb turned on');
        doNotDisturb = true;
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.write('Do not disturb set to' + doNotDisturb);
        res.end();
        return;
      }

      if (uri == '/donotdisturboff') {
        console.log('Do not disturb turned off');
        doNotDisturb = false;
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.write('Do not disturb set to' + doNotDisturb);
        res.end();
        return;
      }
  

      var filename = path.join("./", uri);
      console.log('mapped filename: '+filename)
      fs.exists(filename, async function (exists: any) {
        if (!exists) {
          console.log('file not found: ' + filename);
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.write('file not found: %s\n', filename);
          res.end();
        }  else {
             console.log('sending file: ' + filename);
             switch (path.extname(uri)) {
             case '.png':
                res.writeHead(200, { 'Content-Type': 'image/png' });
                var stream = fs.createReadStream(filename, { bufferSize: 64 * 1024 });
                stream.pipe(res);
                break;
            default:
                console.log('unknown file type: ' + path.extname(uri));
                res.writeHead(500);
                res.end();
             }
        }
      });

    }).listen(PORT);

   console.log('Started server, listening on port '+PORT+'.')
}

async function runMain () {
  if(!('RING_REFRESH_TOKEN' in process.env) || !('RING_PORT' in process.env) || !('CAMERA_NAME' in process.env)) {
    console.log('Missing environment variables. Check RING_REFRESH_TOKEN, RING_PORT and CAMERA_NAME are set.')
    process.exit()
  }
  else {

    //set the value at the start
    postMotionEventNum(eventCount);

    await connectToRing();
    camera = await getCamera();

    publicOutputDirectory = path.join('public/')
    console.log('output directory: '+publicOutputDirectory)

    if (!(await promisify(fs.exists)(publicOutputDirectory))) {
      await promisify(fs.mkdir)(publicOutputDirectory)
    }
    //delete files every hour
    setInterval(deletefiles, 360000);

    //reset the event count once a day
    schedule.scheduleJob('59 23 * * *',resetEventCount);

    await startHttpServer();
    startCameraPolling(true);
  }
}

function deletefiles() {
  var result = findRemoveSync(__dirname + '/' +publicOutputDirectory, {extensions: ['.png'], ignore: 'error.png'});
  console.log('Deleted the files: ' + result);
}

function resetEventCount() {
  console.log("Reset event Count");
  eventCount = 0;
  //set the value at the start
  postMotionEventNum(eventCount);
}

runMain();
