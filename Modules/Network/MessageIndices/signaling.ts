

import ByteIStream from "../../Core/byteistream";
import Arg from "../arg"
import { Message, MessageDomain, ConnectionState } from '../network';

//const MESSAGE_ROOT = new MessageDomain();


/*export type StatusUpdate = {
	[ConnectionState.CONNECTING]: Array<number>,
	[ConnectionState.CONNECTED]: Array<number>,
	[ConnectionState.DISCONNECTED]: Array<number>,
};*/

//const STUN = new Message(Message.RAW);
export const MESH_INITIALIZE = new Message({
	localID: Arg.UINT2,
	peerIDs: Arg.array(Arg.UINT2)
});
export const MESH_TERMINATE = new Message();
export const MESH_CONNECT_PEERS = new Message({
	peerIDs: Arg.array(Arg.UINT2)
});
export const MESH_DISCONNECT_PEERS = new Message({
	peerIDs: Arg.array(Arg.UINT2)
});
//const MESH_CREATION_COMPLETED = new Message();
export const MESH_STABILIZED = new Message();
//const MESH_DESTABILIZED = new Message();

export const MESH_SESSION_DESCRIPTION_CREATED = new Message({
	peerID: Arg.UINT2,
	type: Arg.choice("offer", "answer"),
	sdp: Arg.STRING2
});
export const MESH_ICE_CANDIDATE_CREATED = new Message({
	peerID: Arg.UINT2,
	//media: Arg.STRING1,
	//index: Arg.UINT2,
	//name: Arg.STRING2
	candidate: Arg.STRING2,
	sdpMid: Arg.STRING2,
	sdpMLineIndex: Arg.UINT2,
	usernameFragment: Arg.STRING2
});



export const MESH_STATUS_UPDATE = new Message();
/*export const MESH_CLIENT_STATUS_UPDATE = new Message([{
	pendingIDs: Arg.array(Arg.UINT2),
	connectedIDs: Arg.array(Arg.UINT2),
	disconnectedIDs: Arg.array(Arg.UINT2),
}]);*/
export const MESH_CLIENT_STATUS_UPDATE = new Message([
	Arg.array(Arg.UINT2),
	Arg.array(Arg.UINT2),
	Arg.array(Arg.UINT2)
]);

/*console.log(
	MESSAGE_ROOT.findMessage(new ByteIStream(new Uint8Array())),
	MESSAGE_ROOT.findMessage(new ByteIStream(new Uint8Array([1, 0])))
);*/

const MESSAGE_ROOT = new MessageDomain([
	MESH_INITIALIZE,
	MESH_TERMINATE,
	MESH_CONNECT_PEERS,
	MESH_DISCONNECT_PEERS,
	MESH_STABILIZED,
	MESH_SESSION_DESCRIPTION_CREATED,
	MESH_ICE_CANDIDATE_CREATED,
	MESH_STATUS_UPDATE,
	MESH_CLIENT_STATUS_UPDATE
]);

export default MESSAGE_ROOT;


