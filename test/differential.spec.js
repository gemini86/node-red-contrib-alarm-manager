const assert = require('assert');
const EventEmitter = require('events');

const RED = {
    nodes: {
        createNode(node, config) {
            EventEmitter.call(node);
            Object.setPrototypeOf(node, EventEmitter.prototype);
            node.status = function(){};
            node.warn = function(){};
            node.error = function(){};
        },
        getNode() {
            return alarmManager;
        },
        registerType(type, ctor) {
            RED.constructor = ctor;
        }
    },
    util: {
        cloneMessage: obj => JSON.parse(JSON.stringify(obj))
    }
};

let alarmManager;
require('../alarm-manager/condition-monitor.js')(RED);

function createNodes() {
    alarmManager = new EventEmitter();
    alarmManager.registerAlarmNode = () => undefined;
    alarmManager.clearAlarm = msg => alarmManager.emit('alarmEvent', msg);
    alarmManager.setAlarm = msg => alarmManager.emit('alarmEvent', msg);

    const config = {
        alarmId: 'a1',
        highAlarm: 10,
        lowAlarm: 0,
        differential: 2,
        delayMinutes: 0,
        debug: false,
        alarmManager: 'm1'
    };

    const node = new RED.constructor(config);
    node.alarmManager = alarmManager;
    return node;
}

describe('condition-monitor differential', function() {
    it('clears alarm only after differential threshold crossed', function(done) {
        const node = createNodes();
        const events = [];
        alarmManager.on('alarmEvent', evt => events.push(evt.payload.type));

        node.emit('input', {payload:12});
        setTimeout(function(){
            node.emit('input', {payload:9});
            setTimeout(function(){
                node.emit('input', {payload:7});
                setTimeout(function(){
                    try {
                        assert.deepStrictEqual(events, ['high','clear']);
                        done();
                    } catch(err) {
                        done(err);
                    }
                }, 5);
            }, 5);
        }, 5);
    });
});
