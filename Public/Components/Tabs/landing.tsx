

import React from "react";
import client from "../../client_instance";
//import LocalGameClient from "../../game_client";

const urlParams = new URLSearchParams(window.location.search);

export default function Landing() {
	
	const sanitize = (value: string | null) => value === null ? "" : value;
	
	let name = sanitize(localStorage.getItem("playerName"));
	let code = sanitize(urlParams.get("code"));
	
	//if (name !== "" && code !== "") // Quick join
	//	client.joinGame(name, code);
	
	const setName = (newName: string) => {
		
		name = newName;
		
		try {
			localStorage.setItem("playerName", newName)
		}
		catch(e) {
			
		}
		
	}
	
	const setCode = (newCode: string) => code = newCode;
	
	return (
		<div id="landing" className="tab">
			<input id="name-input" defaultValue={name} onChange={ev => setName(ev.target.value)} placeholder="Name"></input>
			<input id="code-input" defaultValue={code} onChange={ev => setCode(ev.target.value)} placeholder="Code"></input>
			<button id="join-btn" onClick={ev => client.requestJoin(name, code)}>Join</button>
			<button id="create-btn" onClick={ev => client.requestCreate(name)}>Create</button>
		</div>
	);
	
}


