module.exports = function (RED) {
	function AlarmManagerNode(config) {
		RED.nodes.createNode(this, config);
		let node = this;
		let nodeContext = this.context();
		node.delayInterval = config.delayMinutes * 60000;
		node.resendInterval = config.resendMinutes * 60000;
		node.debug = config.debug; //when enabled, will send all new alarms to the node.log;

		let currentAlarms = nodeContext.currentAlarms || {};

		node.setAlarm = function (alarm) {
			//check if an alarm for this id already exists
			if (Object.prototype.hasOwnProperty.call(currentAlarms, alarm.id)) {
				//update the alarm value
				currentAlarms[alarm.id].value = alarm.value;
			} else {
				//set new alarm
				alarm.persistent = false;
				currentAlarms[alarm.id] = alarm;
				sendAfterDelay();
				if (node.debug) {
					node.log(alarm);
				}
			}
		};

		node.clearAlarm = function (alarm) {
			//check if alarm already exists
			if (Object.prototype.hasOwnProperty.call(currentAlarms, alarm.id)) {
				//has it already been sent?
				if (currentAlarms[alarm.id].persistent) {
					currentAlarms[alarm.id] = alarm; //update alarm (this clear alarm object will have 'clearTimestamp' property with the time of alarm clearing and a 'type' property of "clear")
					sendAfterDelay(); //this will send all alarms with the current alarm marked as "clear"
				} else {
					//if it's not been sent, delete it right away.
					delete currentAlarms[alarm.id];
					checkAlarmsCount(); //this checks for any alarms and clears intervals if needed.
				}
			} else {
				node.error('This alarm does not exist and cannot be cleared: ' + alarm);
			}
		};

		node.getAlarms = function () {
			if (currentAlarms) {
				return currentAlarms;
			} else {
				return undefined;
			}
		};

		let sendAlarms = function (input) {
			node.emit('alarms', input);
			if (node.debug) {
				node.log('alarms sent: ' + input);
			}
		};

		let sendAfterDelay = function () {
			node._ongoingDelay = setTimeout(() => {
				if (checkAlarmsCount()) {
					sendAlarms(currentAlarms);
					resendAfterDelay();
				}
			}, node.delayInterval);
		};

		let resendAfterDelay = function () {
			//if there's already an interval set, clear it
			if (node._ongoingInterval) {
				clearInterval(node._ongoingInterval);
				delete node._ongoingInterval;
				if (node.debug) {
					node.log('interval to resend alarms was reset');
				}
			}
			node._ongoingInterval = setInterval(() => {
				if (checkAlarmsCount()) {
					node.sendAlarms(currentAlarms);
					if (node.debug) {
						node.log('Alarms resent');
					}
				}
			}, node.resendInterval);
		};

		let checkAlarmsCount = function () {
			let count = Object.getOwnPropertyNames(currentAlarms).length;
			if (count > 0) {
				return count;
			} else {
				nodeContext.currentAlarms = {};
				if (node._ongoingInterval) {
					clearInterval(node._ongoingInterval);
					delete node._ongoingInterval;
				}
				if (node._ongoingDelay) {
					clearTimeout(node._ongoingDelay);
					delete node._ongoingDelay;
				}
				return false;
			}
		};
	}
	RED.nodes.registerType('alarm manager', AlarmManagerNode);
};
