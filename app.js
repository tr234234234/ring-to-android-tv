/*
 * app.js
 * 
 * This node application acts as a bridge between the ring-client-api and the PiPup Android
 * application to show Ring camera snapshots as an overlay/popup on Android TV devices.
 * 
 * Remember to change the tvIpAddress variable and save your API token to token.txt.
 */

// Dependencies
const RingApi = require('ring-client-api')
const fs = require('fs')
const request = require('request')
const { promisify } = require('util')
const { exit } = require('process')
const http = require('http')
const url = require('url')
const path = require('path')
const Jimp = require('jimp')
require('dotenv').config()

// Configuration
const tvIpAddress = process.env.R2ATV_IP_ADDRESS            // IP address of the Android TV you are running PiPup on
const displayTime = process.env.R2ATV_DISPLAY_TIME || 12    // Display time for notifications, in seconds
const PORT = process.env.SERVER_PORT;
const CAMERA_NAME = process.env.CAMERA_NAME;
var chosenCamera = CAMERA_NAME;

var ringApi;
var doorcamera;
var lastImageFileName = "error.png";

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
            "image" : (imageFile == '') ? "" : fs.createReadStream(__dirname + '/' + imageFile),
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

async function listLocationsAndCameras() {
    locations = await ringApi.getLocations().catch(error => {
        console.log('[ERROR] Unable to retrieve camera locations because: ' + error.message)
        process.exit(1) // exit with error code
    })
    intLocation = 0
    intCamera = 0

    locations.forEach(function(location) {
        intCamera = 0
        console.log(`Found location[${intLocation}]: ${location.name}`)

        // Subscribe to each camera at this location.
        location.cameras.forEach(function(camera) {
            console.log(`\t - Found ${camera.model} named ${camera.name}. Test with --test ${intLocation},${intCamera}`)
            intCamera++
        })
        intLocation++
    })

    process.exit()
}

/**
 * For testing: onnects to the first camera at first detected location, saves and sends a snapshot notification.
 * @param {*} intLocation Number of location to use in Location array.
 * @param {*} intCamera Number of camera to use in Location->Camera array.
 */
async function getTestSnapshot(intLocation = 0, intCamera = 0) {
    const locations = await ringApi.getLocations().catch(error => {
        console.log('[ERROR] Unable to retrieve camera locations because: ' + error.message)
        process.exit(1) // exit with error code
    })

    const location = locations[intLocation]
    const camera = location.cameras[intCamera]

    console.log(`Attempting to get snapshot for location #${intLocation}, camera #${intCamera}`)
    
    try {
        const snapshotBuffer = await camera.getSnapshot()
        console.log('Snapshot size: ' + Math.floor(snapshotBuffer.byteLength/1024) + ' kb')
    
        fs.writeFile(__dirname + '/snapshot.png', snapshotBuffer, (err) => {
            // throws an error, you could also catch it here
            if (err) throw err;
        
            // success case, the file was saved
            console.log('Snapshot saved!')
            sendNotification('Test Snapshot', 'This is a test snapshot message!', 'snapshot.png', true)
        })
    } catch (e) {
        // failed to get a snapshot.  handle the error however you please
        console.log('Unable to get snapshot...')
        console.log(e)
        sendNotification('Test Snapshot Failed', 'An error occured trying to get a snapshot!', 'error.png', true)
    }
}

function timeStamp() {
    // Create a date object with the current time
      var now = new Date();
    
    // Create an array with the current month, day and time
      var date = [now.getFullYear(), now.getMonth() + 1, now.getDate()];
    
    // Create an array with the current hour, minute and second
      var time = [ now.getHours(), now.getMinutes(), now.getSeconds() ];
    
    if( date[1] < 10 ) {
        date[1] = "0" + date[1];
    }
    if( date[2] < 10 ) {
        date[2] = "0" + date[2];
    }

    // If seconds and minutes are less than 10, add a zero
      for ( var i = 0; i < 3; i++ ) {
        if ( time[i] < 10 ) {
          time[i] = "0" + time[i];
        }
      }
    
    // Return the formatted string
      return date.join("-") + "_" + time.join("-");
    }

/**
 * Starts polling a Ring camera for events and grabs snapshots on motion/dings.
 * @param {*} notifyOnStart Whether to send a notification when beginning camera polling.
 */
async function startCameraPolling(notifyOnStart) {
    // Begin polling camera for events
    const locations = await ringApi.getLocations().catch(error => {
        console.log('Unable to retrieve camera locations because: ' + error.message)
        process.exit(1) // exit with error code
    })
    
    locations.forEach(function(location) {
        console.log(`Found location: ${location.name}`)

        // Subscribe to each camera at this location.
        location.cameras.forEach(function(camera) {
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

                // Grab new snapshot
                try {
                    const snapshotBuffer = await camera.getSnapshot().catch(error => {
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
                                fs.writeFile(__dirname + '/' + filename, imageBuffer, (err) => {
                                    // throws an error, you could also catch it here
                                    if (err) throw err;
                                
                                    // success case, the file was saved
                                    console.log('Snapshot saved! '+ filename);
                                    sendNotification(notifyTitle, notifyMessage, filename);
                                    fs.copyFile(filename, "snapshot.png", (err) => {
                                        if (err) {
                                          console.log("Error Found:", err);
                                        }
                                    });
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

                console.log('')
            }, err => {
                console.log(`Error subscribing to ${location.name} ${camera.name}:`)
                console.log(err)
            },
            () => {
                console.log('Subscription complete.') // We shouldn't get here!
            })

        })
    })

    // Send notification on app start, if enabled.
    if(notifyOnStart) sendNotification('ring-to-android-tv', 'Ring notifications started!', '')
}


async function startHttpServer() {
    
    server = http.createServer(function (req, res) {
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
        var filename = lastImageFileName;
        fs.exists(filename, async function (exists) {
            if (!exists) {
              console.log('file not found: ' + filename);
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.write(`file not found: ${filename}\n`);
              res.end();
            }  else {
                console.log('sending file: ' + filename);
                res.writeHead(200, { 'Content-Type': 'image/png',
                                    'Content-Disposition': `inline; filename=${filename}` });
                var stream = fs.createReadStream(filename, { bufferSize: 64 * 1024 });
                stream.pipe(res);
            }
        } );
        return;
      }

      if (uri == '/currentimage') {
        // Grab new snapshot
        try {
            doorcamera = getCamera();
            const snapshotBuffer = doorcamera.getSnapshot().catch(error => {
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
                    res.writeHead(200,{'Content-Type':'image/png'});
                    res.write(imageBuffer);
                    res.end();
                  });
                  });
              })
              .catch(err => {
                // Handle an exception.
                console.log ('Cound not add text to image')
              });
        } catch (e) {
            // Failed to retrieve snapshot. We send text of notification along with error image.
            // Most common errors are due to expired API token, or battery-powered camera taking too long to wake.
            console.log('Unable to get snapshot.')
            console.error(e.name + ': ' + e.message)
        }
        return;
      }


      var filename = path.join("./", uri);
      console.log('mapped filename: '+filename)
      fs.exists(filename, async function (exists) {
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

async function connectToRing() {
  
    ringApi = new RingApi({
      // Refresh token is used when 2fa is on
      refreshToken: process.env.R2ATV_API_TOKEN,
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
async function getCamera() {
    var cameras = await ringApi.getCameras();
    var camera;
    //
    if (chosenCamera) {
      for (var i=0; i < cameras.length; i++) {
        var cameraName = cameras[i].initialData.description;
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


async function runMain () {
    await connectToRing();

    if(process.argv.includes('--test')) {
        // Just grab a snapshot for testing, then exit.
        console.log('Attempting to get demo snapshot...')
        try {
            intArg = process.argv.indexOf('--test')
            var intLocation = intCamera = 0
            if(process.argv.length > intArg + 1) {
                // Attempt to get location,camera from next arg.
                strLocCam = process.argv[intArg + 1]
                intLocation = strLocCam.split(',')[0]
                intCamera = strLocCam.split(',')[1]
            }
            getTestSnapshot(intLocation, intCamera)
        } catch (e) {
            console.log('Error attempting to call getTestSnapshot().')
            console.log(e)
            process.exit()
        } finally {
            //process.exit()
        }
    } else if(process.argv.includes('--list')) {
        listLocationsAndCameras()
    } else {
        
        startHttpServer();
        startCameraPolling(true)
    }
}

runMain();

