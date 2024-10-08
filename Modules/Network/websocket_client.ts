

import Signal from "../Core/signal"
import {
	
	ConnectionState,
	
	Message,
	LocalMonoPeer,
	
} from "./network"



export default class Socket extends LocalMonoPeer {
	
	
	public closed = new Signal<void>();
	//public error = new Signal<void>();
	
	
	private ws: WebSocket;
	
	constructor(url: string, protocols?: Array<string>) {
		
		super();
		
		this.ws = new WebSocket(url, protocols);
		
		this.ws.binaryType = "arraybuffer";
		
		this.ws.onopen = (e: Event) => this.state.set(ConnectionState.CONNECTED);
		this.ws.onclose = (e: CloseEvent) => this.close();
		this.ws.onerror = (e: Event) => this.close(); // Maybe wants some error handling
		this.ws.onmessage = (e: MessageEvent<ArrayBuffer>) => this.handleRaw(undefined, new Uint8Array(e.data));
		
	}
	
	
	send<T>(message: Message<T>, data: T = undefined as T): void {
		//this.ws.send(this.messageRoot.createRaw(message, data));
		this.ws.send(this.createRaw(message, data));
	}
	
	
}

