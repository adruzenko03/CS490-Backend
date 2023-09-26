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
    `select film.*, language.name from film, inventory, rental, language
    where film.film_id=inventory.film_id and inventory.inventory_id=rental.inventory_id and language.language_id=film.language_id
    group by film.film_id
    order by Count(rental_id) DESC
    limit 5`, 
    (err, rows, fields) => {
      connection.query(
        //DATE_FORMAT(last_update, '%m/%d/%Y %H:%i') as l_u
        `select actor.*, COUNT(film.film_id) as film_count from film, film_actor, actor
        where film.film_id=film_actor.film_id and film_actor.actor_id=actor.actor_id
        group by actor.actor_id
        order by Count(film.film_id) DESC
        limit 5`, 
        (err, rows2, fields) => {
          console.log(rows2)
          socket.emit("queries", {"movies":rows,"actors":rows2})
        })

  })
    
});