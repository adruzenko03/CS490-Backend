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
          socket.emit("queries", {"movies":rows,"actors":rows2})
        })

  })
  socket.on('movieSearch', (search)=>{
    if(search.param=="Name"){
      connection.query(
        `select * from film
        where title like '%${search.input}%'
        limit 100`, 
        (err, rows, fields) => {
          console.log(rows)
          socket.emit("movieRes", rows)
        })
    }
    if(search.param=="Actor"){
      connection.query(
        `select film.* from film, film_actor, actor
        where film.film_id=film_actor.film_id and film_actor.actor_id=actor.actor_id
        and concat(first_name," ",last_name)='${search.input}'
        limit 100`, 
        (err, rows, fields) => {
          console.log(rows)
          socket.emit("movieRes", rows)
        })
    }
    if(search.param=="Genre"){
      connection.query(
        `select film.* from film, film_category, category
        where film.film_id=film_category.film_id and film_category.category_id=category.category_id
        and name='${search.input}'`, 
        (err, rows, fields) => {
          console.log(rows)
          socket.emit("movieRes", rows)
        })
    }
  })   
  socket.on('custSearch',(searchParams)=>{
      connection.query(
        `select customer.*,group_concat(IF(return_date is null, title, NULL)) as rented from inventory, rental, customer,film
        where inventory.inventory_id=rental.inventory_id and rental.customer_id=customer.customer_id and film.film_id=inventory.film_id
        and (customer.customer_id='${searchParams.ID}' or '${searchParams.ID}'='undefined')
        and (customer.first_name='${searchParams.First}' or '${searchParams.First}'='undefined')
        and (customer.last_name='${searchParams.Last}' or '${searchParams.Last}'='undefined')
        group by customer.customer_id
        `,
        (err, rows, fields) => {
          socket.emit("customerRes",rows)
        })
  })
  socket.on('pdfGen',()=>{
    connection.query(
      `select customer.*,group_concat(IF(return_date is null, title, NULL)) as rented from inventory, rental, customer,film
      where inventory.inventory_id=rental.inventory_id and rental.customer_id=customer.customer_id and film.film_id=inventory.film_id
      group by customer.customer_id
      having count(IF(return_date is null, title, NULL))
      `,(err,rows,fields) =>{
        socket.emit("pdfRes",rows)
      })
  })
  socket.on('custRent',(params)=>{
    connection.query(
      `
            select customer.* from customer, staff
      where customer.first_name='${params.customer.split(" ")[0]}' and customer.last_name='${params.customer.split(" ")[1]}'
      and customer.active=1 and staff.active=1 and staff.store_id=customer.store_id and staff.staff_id=${params.staff}
      `,(err,rows,fields) =>{
        if(rows==undefined || rows.length==0){
          socket.emit("custResp", false, "Both the customer and staff must be active members of the same store")
        }
        else{
          connection.query(`select * from inventory as I
          where store_id=${rows[0].store_id} and film_id=${params.film} and 
          not exists
          (select * from rental 
            where rental.inventory_id=I.inventory_id and return_date is null
             )`,(err,rows2,fields)=>{
              if(rows2==undefined || rows2.length==0){
                socket.emit("custResp", false, "This movie is not currently available at this store")
              }
              else{
                connection.query(`insert into rental (rental_date, inventory_id, customer_id,staff_id,last_update)
                values (now(), ${rows2[0].inventory_id},${rows[0].customer_id},${params.staff},now())`,()=>{
                  socket.emit("custResp",true)
                })
              }
             })
        }
      })
  })
});

