
/* global process, pb2Web */

const { contextBridge, ipcRenderer } = require('electron');

const api = 
{
    // Simple static data
    //IS_DESKTOP_APP: true,
	
	test: 1,
	
	// ipcRenderer.send for no return value
	SendUDP: ( data )=>ipcRenderer.send( ':SendUDP', data ),
	Quit: ( data )=>ipcRenderer.send( ':Quit', data ),
	SetTargetDomain: ( domain )=>ipcRenderer.send( ':SetTargetDomain', domain ),
	CheckForAppUpdates: ()=>ipcRenderer.send( ':CheckForAppUpdates' ),
	UpdateNow: ()=>ipcRenderer.send( ':UpdateNow' ),
	
	// ipcRenderer.invoke to return Promise
	//___: ()=>ipcRenderer.invoke( ':___' ),
	
	
	// return ipcRenderer.sendSync for synchronous return values
	GetUDP: ( key )=>ipcRenderer.sendSync( ':GetUDP', key )
	
};


ipcRenderer.on( 'app-update-available', ( event, data )=>
{
	if ( typeof pb2Web !== 'undefined' )
	if ( pb2Web.GetHashInfo().section === 'menu' )
	pb2Web.NewNote( `Application update is available<br><br><a onclick="electronAPI.UpdateNow()">Click here to update & restart</a>` );
});
		

// Expose the API at globalThis.electronAPI
contextBridge.exposeInMainWorld( 'electronAPI', api );