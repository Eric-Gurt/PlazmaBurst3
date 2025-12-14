/* global __dirname, process */
const { app, Tray, Menu, globalShortcut, BrowserWindow, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const WebSocket = require('ws');
const dgram = require('dgram');
const path = require('path');
const { ipcMain, session, clipboard } = require('electron');

const trace = console.log;

// Test 3

let initial_website_url = 'https://www.plazmaburst.net';
if ( process.argv.indexOf( '--PB3_FORCE_LOCALHOST' ) !== -1 )
initial_website_url = 'http://localhost';


let target_domain = '?';
let target_port = 2347;

// TODO: Add domain to IP lookup so UDP works without DNS checks

let tray = null;
let mainWindow = null;
let connectedClients = 0;
let packetsReceived = 0;
let packetsSent = 0;

let udp = null;

// Configure auto-updater
autoUpdater.autoDownload = false; // Don't auto-download, ask user first
autoUpdater.autoInstallOnAppQuit = false;
let updateAvailable = false;
let updateDownloaded = false;
let updateChecking = false;
let next_update_check_after = 0;

//app.disableHardwareAcceleration();

// DevTools context menu fix
app.commandLine.appendSwitch('disable-features', 'WidgetLayering');

// Don't use integrated GPU
app.commandLine.appendSwitch('force_high_performance_gpu');

// Don't stop background servers and not just servers
app.commandLine.appendSwitch('disable-renderer-backgrounding');

// Disabling V-sync seems to have no effect on anything
//app.commandLine.appendSwitch('disable-gpu-vsync');

// Rate limiting is... well. Can add serious stuttering in main menu
//app.commandLine.appendSwitch('disable-frame-rate-limit');

autoUpdater.on( 'update-available', ( info )=>
{
	trace( 'Update available:', info.version );
	updateAvailable = true;
	updateChecking = false;

	// Show notification
	//showNotification('Update Available', `Version ${info.version} is available. Click to download.`);
	NotifyAboutUpdate();
});

function NotifyAboutUpdate()
{
	if ( mainWindow )
	if ( mainWindow.webContents )
	mainWindow.webContents.send( 'app-update-available', {} );
}

autoUpdater.on( 'update-not-available', ()=>
{
	trace( 'App is up to date' );
	updateAvailable = false;
	updateChecking = false;
});

autoUpdater.on( 'download-progress', ( progressObj )=>
{
	trace( `Download progress: ${ progressObj.percent }%` );
});

autoUpdater.on( 'update-downloaded', ( info )=>
{
	trace( 'Update downloaded:', info.version );
	updateDownloaded = true;

	//showNotification('Update Ready', 'Update will install when you quit the app, or click to restart now.');
});
autoUpdater.on( 'error', (err)=>
{
	console.error( 'Auto-updater error:', err );
});

const delay = ( ms )=>new Promise( resolve => setTimeout( resolve, ms ) );

app.whenReady().then(
	()=>
	{
		StartUDP();
		
		ShowMainWindow();
	}
);

function StartUDP()
{
	if ( udp )
	throw new Error();

	udp = dgram.createSocket( 'udp4' );
	
	let time = Date.now();
	let received_queue = [];
	let outgoing_queue = [];
	let permission_granted_until = 0;
	let permission_denied_until = 0;
	
	let grant_duration = 1000 * 60 * 5;
	
	setInterval( ()=>
	{
		time = Date.now();
	}, 300 );
	
	let debug_udp = 0;
	
	udp.on( 'message', ( msg )=>
	{
		let message = msg.toString();
		
		if ( debug_udp )
		trace( 'Got message: ' + message );
		
		if ( message.startsWith( '?' ) && message.length === 8 + 1 ) // x1 - Server doesn't want out messages, for now at least
		{
			permission_granted_until = time + grant_duration;
			permission_denied_until = 0;
			
			if ( debug_udp )
			trace( 'Sending auth message: ' + message.substring( 1 ) );
		
			udp.send( message.substring( 1 ), target_port, target_domain, onSent );
			return;
		}
		else
		{
			// Prolong granted state
			if ( time < permission_granted_until )
			{
				permission_granted_until = time + grant_duration;
				permission_denied_until = 0;
			}
		}
		
		if ( received_queue.length < 1000 )
		received_queue.push( message );
	});

	udp.on( 'error', ( err )=>
	{
		console.error( 'UDP error:', err );
		
		permission_denied_until = time + 1000;
	});
	
	let onSent = ( err )=>
	{
		if ( debug_udp )
		trace( 'onSend called, error status: ', err );
		
		if ( err )
		{
			console.error( 'Error sending to server:', err );

			permission_denied_until = time + 1000;
		}
	};
	
	udp.pb3Send = ( event, data )=> 
	{
		if ( debug_udp )
        trace( `electron got SendUDP`, data );
		
		if ( time < permission_denied_until )
		{
			console.error( `Message dropped due to lack of permission` );
			outgoing_queue.push( data );
		}
		else
		{
			let send_iterations = 1;
			
			if ( time >= permission_granted_until )
			{
				permission_denied_until = time + 1000;
				send_iterations = outgoing_queue.length; // Send all scheduled messages
			}
			
			if ( outgoing_queue.length === 0 )
			udp.send( data, target_port, target_domain, onSent );
			else
			{
				outgoing_queue.push( data );
				while ( outgoing_queue.length > 0 && send_iterations-- > 0 )
				udp.send( outgoing_queue.shift(), target_port, target_domain, onSent);
			}
		}
    };
	
	udp.pb3Get = ( event )=>
	{
		event.returnValue = received_queue;
		received_queue = [];
	};
}

function ShowMainWindow()
{
	if ( mainWindow )
	{
		mainWindow.focus();
		return;
	}
	
	mainWindow = new BrowserWindow(
	{
		width: 1920,
		height: 1000,
		title: 'Plazma Burst 3',
		resizable: true,
		fullscreenable: true,

		webPreferences: 
		{
			//nodeIntegration: true,
			//contextIsolation: false,

			sandbox: true,
			contextIsolation: true,
			nodeIntegration: false,
			enableRemoteModule: false,
			webSecurity: true,
			allowRunningInsecureContent: false,

			partition: 'persist:pb3-isolated-data',

			backgroundThrottling: false,

			preload: path.join( __dirname, 'preload.js' )
		}
	});
	
	
	
	const toolbarTemplate = [
		{
			label: 'Menu',
			click: ()=>
			{
				mainWindow.loadURL( initial_website_url );
			}
		},
		{
			label: 'Copy URL',
			click: ()=>
			{
				clipboard.writeText( mainWindow.webContents.getURL() );
			}
		},
		{
			label: 'Paste URL',
			click: ()=>
			{
				mainWindow.loadURL( clipboard.readText() );
			}
		},
		{
			label: 'DevTools',
			accelerator: 'CmdOrCtrl+Shift+I',
			click: ()=>mainWindow.webContents.openDevTools()
		},
		{
			label: 'Fullscreen',
			accelerator: 'Alt+Enter', 
			click: ()=>toggleFullscreen()
		}
	];
	const menu = Menu.buildFromTemplate( toolbarTemplate );
    Menu.setApplicationMenu( menu );
	globalShortcut.register( 'F11', ()=>toggleFullscreen() );
	globalShortcut.register( 'F12', ()=>mainWindow.webContents.openDevTools() );
	
	function toggleFullscreen()
	{
		setTimeout( ()=>
		{
			const isCurrentlyFullScreen = mainWindow.isFullScreen();

			mainWindow.setFullScreen( !isCurrentlyFullScreen );
		}, 1 );
	};
	
	ipcMain.on( ':SetTargetDomain', ( event, domain )=>{
		
		switch ( domain )
		{
			case 'localhost':
			case 'www.plazmaburst.net':
			case 's1.plazmaburst.net':
			case 's2.plazmaburst.net':
			case 's3.plazmaburst.net':
			case 's4.plazmaburst.net':
				target_domain = domain;
			break;
			default:
				console.error( 'UDP domain ' + domain + ' is unrecognized' );
			break;
		}
	} );
	
	function Quit()
	{
		if ( mainWindow )
		{
			if ( udp )
			{
				udp.close();
				udp = null;
			}
			app.quit();

			mainWindow = null;
		}
	}
	
	ipcMain.on( ':Quit', Quit );
	
	ipcMain.on( ':CheckForAppUpdates', ( event )=> 
	{
		if ( updateAvailable )
		NotifyAboutUpdate();
		else
		{
			let time = Date.now();
			if ( time > next_update_check_after )
			{
				next_update_check_after = time + 1000 * 60 * 5;

				if ( !updateChecking )
				{
					updateChecking = true;
					autoUpdater.checkForUpdates(); // Won't do anything unless packaged, will just hang in checking state
				}
			}
		}
	});
	ipcMain.handle( ':UpdateNow', ()=>
	{
		if ( updateDownloaded )
		{
			mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent( `Installing update...` ));
			autoUpdater.quitAndInstall();
		}
	});
	
	
	ipcMain.on( ':SendUDP', udp.pb3Send );
	
	ipcMain.on( ':GetUDP', udp.pb3Get );
	
	mainWindow.webContents.on( 'context-menu', ( event, params )=>
	{
		// 1. Check if a link URL exists at the click position
		const linkUrl = params.linkURL;
		const isLink = linkUrl && linkUrl.length > 0;

		// 2. Define the base menu template
		const template = [];

		// --- Dynamic Link Items ---
		if ( isLink )
		{
			template.push({
				label: 'Copy Link URL',
				click: ()=>
				{
					// Use the Electron clipboard module to write the URL
					clipboard.writeText(linkUrl);
				}
			});
			template.push({
				label: 'Open Link in Browser',
				click: ()=>
				{
					// Use the shell module to open the link in the user's default external browser
					shell.openExternal(linkUrl);
				}
			});
			template.push({ type: 'separator' });
		}

		// --- Standard Text Items (Always present if text is selected) ---
		if ( params.selectionText )
		template.push({ role: 'copy' });

		// --- Debug/Standard Items ---
		template.push({
			label: 'Inspect Element',
			click: ()=>
			{
				// Inspects the element at the x, y coordinates
				mainWindow.webContents.inspectElement(params.x, params.y);
			}
		});

		// 3. Build and show the menu
		const menu = Menu.buildFromTemplate(template);
		menu.popup( mainWindow );
	});
	

	mainWindow.on( 'page-title-updated', ( event, title )=>
	{
		event.preventDefault();
	});
  
	// Open DevTools automatically
	if ( initial_website_url === 'http://localhost' )
	mainWindow.webContents.openDevTools();
  
	
	mainWindow.webContents.on( 'render-process-gone', ( event, webContents, details )=>
	{
		console.error( 'Renderer process crashed!' );
		console.error( 'Event Details:', event, webContents, details );
		// Reload the window for recovery:
		// mainWindow.reload(); 
	});
	
	
	session.defaultSession.webRequest.onBeforeRequest( ( details, callback )=>
	{
		let isBlocked = false;
		
		if ( isBlocked )
		{
			trace( `[BLOCKED by webRequest]: ${ details.url}` );
			// Return { cancel: true } to block the request
			callback({ cancel: true }); 
		}
		else
		{
			// Return { cancel: false } to allow the request
			callback({ cancel: false });
		}
	});
	
	
	
	
	//mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`Redirect in 1 second`));
  
	mainWindow.loadURL( initial_website_url );

	mainWindow.on( 'closed', Quit );
}