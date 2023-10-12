import { hostname } from 'os';
import * as chai from 'chai';
import socketio_client from 'socket.io-client';
chai.should()
var end_point = 'http://' + hostname() + ':8081';
var opts = {forceNew: true};

describe("async test with socket.io", function () {
this.timeout(10000);

it('Initial Connection Queries',(done)=>{
    setTimeout(function () {
        var socket_client = socketio_client(end_point, opts);  
        socket_client.on('queries',(data)=>{
            chai.assert(typeof data.cities[0]==typeof 'string')
            chai.assert(typeof data.movies==typeof {})
            done()
        })

    })
})


it('Initial Customer Retrieval', function (done) {
    setTimeout(function () {
        var socket_client = socketio_client(end_point, opts);  

        socket_client.emit('custSearch','');

        socket_client.on('customerRes', function (data) {
            chai.assert(data.length>100)
                        data[0].should.be.an('object')
            socket_client.disconnect();
            done();
        });
    })

})
it('Test Search Functionality (First Name),',(done)=>{
    setTimeout(function () {
        var socket_client = socketio_client(end_point, opts);  
        socket_client.emit('custSearch',{ First: "al" })
        socket_client.on('customerRes', function (data) {
            chai.assert(data[0].first_name.toLowerCase()=='al')
            done()

        })
    })

})

it('Test Search Functionality (ID),',(done)=>{
    setTimeout(function () {
        var socket_client = socketio_client(end_point, opts);  
        socket_client.emit('custSearch',{ ID: 600 })
        socket_client.on('customerRes', function (data) {
            chai.assert(data[0].customer_id==600)
            done()

        })
    })

})
it('Correct values for customer details,',(done)=>{
    setTimeout(function () {
        var socket_client = socketio_client(end_point, opts);  
        socket_client.emit('custSearch',{ ID: 600 })
        socket_client.on('customerRes', function (data) {
            chai.assert(data[0].first_name.toLowerCase()=='al')
            chai.assert(data[0].last_name.toLowerCase()=='ed')
            chai.assert(data[0].address_id==608)
            done()

        })
    })

})

it('Updates customers correctly,',(done)=>{
    setTimeout(function () {
        var socket_client = socketio_client(end_point, opts);  
        socket_client.emit('upCust',{ type:'email',email:'newtest@gmail.com',customer: 'al ed' })
        socket_client.on('upConf', function (data) {
            chai.assert(data=='Successfully updated email')
            done()

        })
    })

})

it('Returns error on incorrect city,',(done)=>{
    setTimeout(function () {
        var socket_client = socketio_client(end_point, opts);  
        socket_client.emit('upCust',{ type:'city',city:'newtest@gmail.com',customer: 'al ed' })
        socket_client.on('upConf', function (data) {
            chai.assert(data=='Choose a valid city')
            done()

        })
    })

})

it('Successfully updates city,',(done)=>{
    setTimeout(function () {
        var socket_client = socketio_client(end_point, opts);  
        socket_client.emit('upCust',{ type:'city',city:'abha',customer: 'al ed' })
        socket_client.on('upConf', function (data) {
            chai.assert(data=='Successfully updated city')
            done()

        })
    })

})
})
