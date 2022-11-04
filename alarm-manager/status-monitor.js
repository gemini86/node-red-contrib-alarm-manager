module.exports = function (RED) {
	function StatusMonitorNode(config) {
		RED.nodes.createNode(this, config);
		let node = this;
		node.alarmId = config.alarmId;
		node.goodInputs = config.goodInputs.split(',');
		node.goodInputs.forEach((string, i) => {
			node.goodInputs[i] = string.trim();
		});
		node.badInputs = config.badInputs.split(',');
		node.badInputs.forEach((string, i) => {
			node.badInputs[i] = string.trim();
		});
		node.strictlyBoolean = config.strictlyBoolean;
		node.delayInterval= config.delayMinutes * 60000;
		node.debug = config.debug;
		node.alarmType = config.alarmType;
		
		//retrive the config node
		node.alarmManager = RED.nodes.getNode(config.alarmManager);

		node.status({});

		//check goodInputs and badInputs do not contain identical strings
		if (this.goodInputs && this.badInputs) {
			for (const string of this.goodInputs) {
				if (this.badInputs.find(e => e == string)) {
					node.error('Configuration Error: "good input" and "bad input" cannot have the same values, each must be unique values or list of values');
				}
			}
		}

		if (node.debug) {
			node.warn('Node configured "good inputs": ' + JSON.stringify(node.goodInputs));
			node.warn('Node configured "bad inputs": ' + JSON.stringify(node.badInputs));
		}

		function isBad(input) {
			if (typeof input == 'boolean') {
				return input == false;
			}

			if (node.badInputs) {
				for (const string of node.badInputs) {
					if (input == string) {
						if (node.debug) {
							node.warn(`payload "${input}" matched a configured bad input`);
						}
						return true;
					}
				}
				return false;
			} else {
				//if config wants strictly bool types, ignore inputs that don't match any config conditions or aren't boolean
				if (node.strictlyBoolean) {
					return undefined;
				}
				//convert truthy ot falsy value to boolean
				return input ? true : false;
			}
		}

		function isGood(input) {
			if (typeof input == 'boolean') {
				return input == true;
			}

			if (node.goodInputs) {
				for (const string of node.goodInputs) {
					if (input == string) {
						if (node.debug) {
							node.warn(`payload "${input}" matched a configured good input`);
						}
						return true;
					}
				}
				return false;
			} else {
				//if config wants strictly bool types, ignore inputs that don't match any config conditions or aren't boolean
				if (node.strictlyBoolean) {
					return undefined;
				}
				//convert truthy ot falsy value to boolean
				return input ? true : false;
			}
		}

		function createAlarmObject(value, type) {
			let alarm = {
				id: node.alarmId,
				timestamp: Date.now(),
				type: type,
				value: value
			};
			return alarm;
		}

		function updateStatus(mode, alarm) {
			if (mode == 'alarm' && alarm) {
				node.status({
					text: `Alarm ${node.alarmSent ? 'fault' : 'pending'}: ${node.alarm.type}`,
					shape: node.alarmSent ? 'dot' : 'ring',
					fill: 'red'
				});
			} else if (mode == 'disabled') {
				node.status({
					text: 'Node disabled',
					shape: 'dot',
					fill: 'grey'
				});
			} else if (mode == 'enabled' || mode == 'clear') {
				node.status({
					text: mode == 'clear' ? `Alarm cleared: ${alarm.value}` : 'Node enabled',
					shape: 'dot',
					fill: 'green'
				});
				setTimeout(() => {
					if (node.alarm) {
						updateStatus('alarm', node.alarm);
					} else if (node.enabled == false) {
						return;
					} else {
						node.status({});
					}
				}, 3000);
			}
		}

		if (node.alarmManager) {
			if (node.debug) {
				node.warn('Registering node with manager...' + node.alarmId);
			}
			node.alarm = node.alarmManager.registerAlarmNode(node, (err, alarmNode) => {
				node.error(err, alarmNode);
				node.status({ text: err, shape: 'dot', fill: 'red' });
			});

			if (node.alarm) {
				updateStatus('alarm', node.alarm);
				if (node.debug) {
					node.warn('Alarm found in alarm manager: ' + JSON.stringify(node.alarm));
				}
			}
		}

		node.alarmManager.on('alarmPush', (msg) => {
			if (msg.payload.has(node.alarmId)) {
				node.alarm = msg.payload.get(node.alarmId);
				node.alarmSent = true;
				updateStatus('alarm', node.alarm);
			} else {
				delete node.alarm;
				node.status({});
			}
		});

		node.on('input', function (msg, send, done) {
			send = send || function () {
				node.send.apply(node, arguments);
			};
			//check if msg.enabled is false, disable the node
			if (msg.enabled == false) {
				if (node.alarm) {
					if (node.alarmSent) {
						node.alarm.type = 'clear';
						node.alarm.clearTimestamp = Date.now();
						msg.payload = node.alarm;
						delete node.enabled;
						node.alarmManager.clearAlarm(msg);
					} else {
						clearTimeout(node.alarmTimer);
					}
					delete node.alarm;
				}
				node.enabled = false;
				updateStatus('disabled');
				if (done) {
					done();
				}
				return;
			}

			if (msg.enabled == true) {
				node.enabled = true;
				updateStatus('enabled');
				if (done) {
					done();
				}
				return;
			}

			if (node.enabled == false) {
				if (done) {
					done();
				}
				return;
			}
			//continue on to check msg input
			if (isBad(msg.payload)) {
				//do bad stuff
				msg.payload = node.alarm = createAlarmObject(msg.payload, node.alarmType);

				if (node.alarmSent) {
					updateStatus('alarm', node.alarm);
					node.alarmManager.setAlarm(msg);
					if (node.debug) {
						node.warn('alarm sent: ' + JSON.stringify(node.alarm));
					}
				} else {
					if (!node.alarmTimer) {
						//start timer to hold pending alarm before sending to the alarm manager.
						node.alarmTimer = setTimeout(() => {
							if (node.debug) {
								node.warn('alarm sent: ' + JSON.stringify(node.alarm));
							}
							node.alarmManager.setAlarm(msg);
							node.alarmSent = true;
							updateStatus('alarm', node.alarm);
							node.alarmTimer = clearTimeout(node.alarmTimer);
						}, node.delayInterval);
					}
					if (node.debug) {
						node.warn('alarm pending: ' + JSON.stringify(node.alarm));
					}
				}
				//update status
				updateStatus('alarm', node.alarm);
			} else if (isGood(msg.payload)) {
				//check if bad stuff was done
				if (node.alarm) {
					//undo bad stuff or do good stuff
					if (node.alarmSent) {
						//clear sent alarm
						node.alarm.type = 'clear';
						node.alarm.clearTimestamp = Date.now();
						node.alarm.value = msg.payload;
						msg.payload = node.alarm;
						node.alarmManager.clearAlarm(msg);
						node.alarmSent = false;
					} else {
						//cancel pending alarm
						node.alarm.value = msg.payload;
						node.alarmTimer = clearTimeout(node.alarmTimer);
					}
					updateStatus('clear', node.alarm);
					if (node.debug) {
						node.warn('alarm cleared: ' + JSON.stringify(node.alarm));
					}
					delete node.alarm;
				}
			} else {
				//ignore other inputs
				if (done) {
					done();
				}
				return;
			}
		});

		node.on('close', function (removed, done) {
			if (removed) {
				node.alarmManager.unregisterAlarmNode(node);
				clearTimeout(node.alarmTimer);
			}
			done();
		});
	}
	RED.nodes.registerType('status-monitor', StatusMonitorNode);
};
