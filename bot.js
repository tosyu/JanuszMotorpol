const slack = require('slack');
const fs = require('fs');
const WebSocket = require('ws');
const config = require('./config.json');

let token = config.bot_token;
let pingTimer = -1;
let lastMessage = Date.now();
let ws = null;
let self = null;

const pingTTL = 1000 * 30; // 30s

const textResponses = [
	{
		q: /^januszu\sidz\sstad$/gi,
		r: 'siedze sobie #author#'
	},
	{
		q: /czesc\sziomus/g,
		r: 'no cotam cotam #author#',
		d: true
	},
	{
		q: /co\s<@[\w\d]+>\slubi\snajbardziej/g,
		r: 'prosta sprawa #author#. Lubi parowki!',
		d: true
	}
];

function send(channel, text) {
	ws.send(JSON.stringify({
		"type": "message",
		"channel": channel,
		"text": text
	}));
	lastMessage = Date.now();
}

function ping() {
	if (Date.now() - lastMessage > pingTTL) {
		ws.send(JSON.stringify({
			"type": "ping"
		}));
		lastMessage = Date.now();
	}
}

function mapFields(text, fields) {
	return new Promise((resolve, reject) => {
		let keys = text.match(/(:?#([a-zA-Z0-9]+)#)+/gi);
		let promises = [];

		keys.forEach((key) => {
			switch (key) {
					case '#author#':
						text = text.replace(/#author#/gi, '<@' + fields.user + '>');
					break;
			}
		});

		if (promises.length > 0) {
			Promise.all(promises).then(() => {
				resolve(text);
			});
		} else {
			resolve(text);
		}
	});
}

function handleChat(message) {
	if (message.text) {
		let found = textResponses.find(function (item) {
			let matches = item.q.test(message.text);
			return (item.d && message.text.indexOf('<@' + self.id + '>') > -1 && matches) ||
				(!item.d && matches);
		});
		if (found) {
			mapFields(found.r, message).then((response) => {
				send(message.channel, response);
			});
		}
	}
}

slack.rtm.connect({token})
	.then((result) => {
		if (result.ok) {
			self = result.self;
			ws = new WebSocket(result.url);
			ws.on('open', () => {
				console.log('connection opened, installing ping-pong with ttl: ' + pingTTL);				
				pingTimer = setInterval(ping, pingTTL);
			});
			ws.on('message', (messageRaw) => {
				let message = {};
				try {					
					message = JSON.parse(messageRaw.toString().replace(/\0/g, ''));
				} catch (err) {
					console.error('error while decoding message', err.message);
				}

				switch (message.type) {
					case 'message':
						handleChat(message);
						break;
					case 'pong':
						// nothing
						break;
				}
			});
		} else {
			console.error('not ok :(');
		}
	})
	.catch((err) => {
		console.error('could not connect', err);
	});
