module.exports = function (RED) {
	function AlarmManagerNode(config) {
		RED.nodes.createNode(this, config);
		let node = this;
		this.name = config.name;
		node.delayInterval = config.delayMinutes * 60000;
		node.resendInterval = config.resendMinutes * 60000;
		node.debug = config.debug; //when enabled, will send all new alarms to the node.log;

		let nodeContext = node.context();

		node.alarmNodeRegistry = nodeContext.get('monitorNodeRegistry') || new Map();

		node.currentAlarms = nodeContext.get('currentAlarms') || new Map();

		node.registerAlarmNode = function (alarmNode, errCallback) {
			//check if the node is already registered
			if (node.alarmNodeRegistry.has(alarmNode.id)) {
				if (node.currentAlarms.has(alarmNode.alarmId)) {
					let thisNodeAlarm = Object.assign({}, node.currentAlarms.get(alarmNode.alarmId));
					delete thisNodeAlarm.persistent;
					return thisNodeAlarm;
				}
			} else {
				//check if the nodeId is unique
				let registryKeys = Array.from(node.alarmNodeRegistry.keys());
				for (let key of registryKeys) {
					if (alarmNode.alarmId == node.alarmNodeRegistry.get(key).alarmId) {
						errCallback(`Error, "${alarmNode.alarmId}" is already being used as an alarm ID. All alarm IDs must be unique.`, alarmNode);
						return;
					}
				}
				
				node.alarmNodeRegistry.set(alarmNode.id, alarmNode);
				node.emit('alarmRegistered', alarmNode.id);

				//if there's a stored alarm for the alarmId, return it, otherwise return nothing.
				return node.currentAlarms.has(alarmNode.alarmId) ? node.currentAlarms.get(alarmNode.alarmId) : undefined;
			}
		};

		node.unregisterAlarmNode = function (alarmNode) {
			if (node.alarmNodeRegistry.has(alarmNode.id)) {
				if (node.currentAlarms.has(alarmNode.alarmId)) {
					let msg = {
						payload: node.currentAlarms.get(alarmNode.alarmId)
					};
					node.clearAlarm(msg);
				}
				node.alarmNodeRegistry.delete(alarmNode.id);
				node.emit('alarmUnregistered', alarmNode.id);
			}
		};

		node.setAlarm = function (msg) {
			let alarm = msg.payload;
			//check if an alarm for this id already exists
			if (node.currentAlarms.has(alarm.id)) {
				//update the alarm value
				node.currentAlarms.get(alarm.id).value = alarm.value;
			} else {
				//set new alarm
				alarm.persistent = false;
				node.currentAlarms.set(alarm.id, alarm);
				if (node.debug) {
					node.warn('Alarm set: ' + JSON.stringify(alarm));
					node.warn('Current alarms: ' + JSON.stringify(node.currentAlarms));
				}
				if (node.delayInterval) {
					//if no timeout is running, start one
					if (!timeout.isRunning) {
						startTimeout(node.delayInterval);
					}
				} else {
					sendAlarms(node.currentAlarms);
				}
			}
			nodeContext.set('currentAlarms', node.currentAlarms);
		};

		node.getAlarm = function (alarmId) {
			return node.currentAlarms[alarmId];
		};

		node.getCurrentAlarms = function () {
			return Object.fromEntries(node.currentAlarms);
		};

		node.loadAlarms = function (alarms) {
			node.currentAlarms = new Map(Object.entries(alarms));
			stopTimeout();
			stopInterval();
			let msg = {
				payload: node.currentAlarms,
			};
			node.emit('alarmPush', msg);
		};

		node.clearAlarm = function (msg) {
			let alarm = msg.payload;
			//check if alarm already exists
			if (node.currentAlarms.has(alarm.id)) {
				//has it already been sent?
				if (node.currentAlarms.get(alarm.id).persistent) {
					node.currentAlarms.set(alarm.id, alarm); //update alarm (this clear alarm object will have 'clearTimestamp' property with the time of alarm clearing and a 'type' property of "clear")
					delete node.currentAlarms.get(alarm.id).persistent; //needed to make sure alarms marked as "clear" are not also marked as "persistent"
					if (node.delayInterval) {
						if (!timeout.isRunning) {
							startTimeout(node.delayInterval);
						}
					} else {
						sendAlarms(node.currentAlarms);
					}
				} else {
					//if it's not been sent, delete it right away.
					node.currentAlarms.delete(alarm.id);
					checkAlarmsCount(); //this will check if there are other alarms and cancel any timeouts and/or intervals
				}
				if (node.debug) {
					node.warn('Alarm cleared:' + JSON.stringify(alarm));
					nodeContext.set('currentAlarms', node.currentAlarms);
				}
				
			} else {
				node.error('This alarm does not exist and cannot be cleared: ' + alarm);
			}
		};

		node.clearAlarms = function () {
			node.currentAlarms.clear();
			stopInterval();
			stopTimeout();
			startInterval(node.delayInterval);
		};
		
		let timeout = {
			//parent: this,
			get isRunning () {
				return timeout._pointer ? true : false;
			},
			timeLeft: function () {
				if (timeout.timeStarted) {
					return Date.now() - timeout.timeStarted;
				}
				return;
			}
		};

		let interval = {
			//parent: this, //stores the parent scope to be used in class methods
			get isRunning () {
				if (interval._pointer) {
					if (node.debug) {
						node.warn('Interval running: ' + interval._pointer);
					}
					return true;
				} else {
					if (node.debug) {
						node.warn('No interval running');
					}
					return false;
				}
			}
		};

		function startTimeout(time) {
			timeout.timeStarted = Date.now();
			timeout._pointer = setTimeout(function () {
				sendAlarms(node.currentAlarms);
				stopTimeout();
				//check if there are alarms to send
				checkAlarmsCount();
				//if no interval is running
				if (interval.isRunning == false) {
					//start interval after sending
					if (node.resendInterval) {
						startInterval(node.resendInterval);
					}
				}
			}, time);
			//if there's an interval running, clear it and delete pointer.
			if (interval.isRunning == true) {
				stopInterval();
			}
		}

		function stopTimeout () {
			timeout._pointer = clearTimeout(timeout._pointer);
			delete timeout.timeStarted;
		}

		function startInterval (time) {
			interval.timeStarted = interval.timeAtLastInterval = Date.now();
			if (!interval.isRunning) {
				interval._pointer = setInterval(function () {
					interval.timeAtLastInterval = Date.now();
					sendAlarms(node.currentAlarms);
					checkAlarmsCount();
				}, time);
			}
		}

		function stopInterval () {
			interval._pointer = clearInterval(interval._pointer);
			delete interval.timeStarted;
			delete interval.timeAtLastInterval;
		}

		function sendAlarms(alarms) {
			//TODO set all alarms sent as persistent after sending.
			if (alarms.size > 0) {
				let msg = { payload: Object.fromEntries(alarms) };
				node.emit('alarms', RED.util.cloneMessage(msg));
				node.emit('persist', RED.util.cloneMessage(msg));
				//mark all sent alarms as persistent (unless cleared alarms, delete those)
				Array.from(alarms.keys()).forEach(key => {
					if (node.currentAlarms.get(key).type == 'clear') {
						node.currentAlarms.delete(key);
					} else {
						node.currentAlarms.get(key).persistent = true;
					}
				});
				nodeContext.set('currentAlarms', node.currentAlarms);
				
				if (node.debug) {
					node.warn('alarms sent: ' + JSON.stringify(msg));
				}				
			} else {
				if (node.debug) {
					node.warn('Warning: alarms not sent because there are none.');
				}
			}
		}

		function checkAlarmsCount() {
			if (node.debug) {
				node.warn('Check alarms count- Current alarms: ' + JSON.stringify(node.currentAlarms));
			}
			if (node.currentAlarms.size > 0) {
				return node.currentAlarms.size;
			} else {
				stopInterval();
				stopTimeout();
				node.emit('persist', { payload: {} });
				return false;
			}

		}

		if (node.debug) {
			node.warn('Current alarms: ' + JSON.stringify(node.currentAlarms));
		}

		node.on('alarmRegistered', (nodeId) => {
			if (node.debug) {
				let text = JSON.stringify(Array.from(node.alarmNodeRegistry.keys()));
				node.warn(`New alarm node (${nodeId}) registered.`);
				node.warn('Registry: ' + text);
			}
		});

		node.on('alarmUnregistered', (nodeId) => {
			if (node.debug) {
				let text = JSON.stringify(Array.from(node.alarmNodeRegistry.keys()));
				node.warn(`Alarm node ${nodeId} was removed from the registry.`);
				node.warn('Registry: ' + text);
			}
		});

		node.on('close', () => {
			node.stopInterval();
			node.startTimeout();
			nodeContext.set('currentAlarms', node.currentAlarms);
		});
	}
	RED.nodes.registerType('alarm-manager', AlarmManagerNode);
};
