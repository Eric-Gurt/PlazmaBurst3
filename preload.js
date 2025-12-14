
/* global process */

const { contextBridge, ipcRenderer } = require('electron');

const api = 
{
    // Simple static data
    //IS_DESKTOP_APP: true,
	
	
	// ipcRenderer.send for no return value
	SendUDP: ( data )=>ipcRenderer.send( ':SendUDP', data ),
	Quit: ( data )=>ipcRenderer.send( ':Quit', data ),
	SetTargetDomain: ( domain )=>ipcRenderer.send( ':SetTargetDomain', domain ),
	
	
	// ipcRenderer.invoke to return Promise
	CheckForAppUpdates: ()=>ipcRenderer.invoke( ':CheckForAppUpdates' ), // Promise
	
	
	// return ipcRenderer.sendSync for synchronous return values
	GetUDP: ( key )=>ipcRenderer.sendSync( ':GetUDP', key )
	
};

// Expose the API at globalThis.electronAPI
contextBridge.exposeInMainWorld( 'electronAPI', api );