
/* global process, pb2Web */

const { contextBridge, ipcRenderer } = require('electron');

let allowed_event_listeners = [ 'app-update-available' ]; // Unsafe to expose other .on-s

const api = 
{
    // Simple static data
    //IS_DESKTOP_APP: true,
	
	test: 5,
	
	// ipcRenderer.send for no return value
	SendUDP: ( data )=>ipcRenderer.send( ':SendUDP', data ),
	Quit: ( data )=>ipcRenderer.send( ':Quit', data ),
	SetTargetDomain: ( domain )=>ipcRenderer.send( ':SetTargetDomain', domain ),
	CheckForAppUpdates: ()=>ipcRenderer.send( ':CheckForAppUpdates' ),
	UpdateNow: ()=>ipcRenderer.send( ':UpdateNow' ),
	
	// ipcRenderer.invoke to return Promise
	//___: ()=>ipcRenderer.invoke( ':___' ),
	
	
	// return ipcRenderer.sendSync for synchronous return values
	GetUDP: ( key )=>ipcRenderer.sendSync( ':GetUDP', key ),
	
	
	// Listeners
	removeAllListeners: ( channel )=>
	{
		if ( allowed_event_listeners.includes( channel ) ) // Unsafe to expose other .on-s
		ipcRenderer.removeAllListeners( channel );
	},
	on: ( channel, callback )=>
	{
		if ( allowed_event_listeners.includes( channel ) ) // Unsafe to expose other .on-s
		ipcRenderer.on( channel, ( event, data )=>callback( data ) );
	}
};

// Expose the API at globalThis.electronAPI
contextBridge.exposeInMainWorld( 'electronAPI', api );