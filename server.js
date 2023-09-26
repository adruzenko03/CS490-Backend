import  express from 'express';
import {Server} from 'socket.io';
import {createServer} from 'node:http';
import * as mysql from 'mysql';


const connection=mysql.createConnection({
  host: 'localhost',
  user: 'server',
  password: 'password1',
  database: 'sakila'
})
connection.connect()
const app = express();
const server = createServer(app);

server.listen(8081, function() {
    console.log('server running on port 8081');
});


const io =new Server(server,{
    cors: {
      origin: "http://localhost:8080"
    }
  });

io.on('connection', function(socket) {
  connection.query(
    `select title from film, inventory, rental
    where film.film_id=inventory.film_id and inventory.inventory_id=rental.inventory_id
    group by film.film_id
    order by Count(rental_id) DESC
    limit 5`, 
    (err, rows, fields) => {
      socket.emit("queries", rows)
  })
    
});