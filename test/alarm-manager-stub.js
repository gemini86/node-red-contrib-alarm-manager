module.exports = function(RED){
    function AlarmManagerNode(config){
        RED.nodes.createNode(this, config);
        const node = this;
        node.currentAlarms = new Map();
        node.registerAlarmNode = function(){ return undefined; };
        node.clearAlarm = function(msg){ node.emit('alarmEvent', msg); };
        node.setAlarm = function(msg){ node.emit('alarmEvent', msg); };
    }
    RED.nodes.registerType('alarm-manager', AlarmManagerNode, { credentials: {}, defaults:{}, category:'config' });
};
