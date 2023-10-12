import express from 'express';
import { Server } from 'socket.io';
import { createServer } from 'node:http';
import * as mysql from 'mysql';


const connection = mysql.createConnection({
  host: 'localhost',
  user: 'server',
  password: 'password1',
  database: 'sakila'
})
connection.connect()

const app = express();
const server = createServer(app);

server.listen(8081, function () {
  console.log('server running on port 8081');
});


const io = new Server(server, {
  cors: {
    origin: "http://localhost:8080"
  }
});

io.on('connection', function (socket) {
  connection.query(
    `select film.*, language.name from film, inventory, rental, language
    where film.film_id=inventory.film_id and inventory.inventory_id=rental.inventory_id and language.language_id=film.language_id
    group by film.film_id
    order by Count(rental_id) DESC
    limit 5`,
    (err, rows, fields) => {
      connection.query(
        `select actor.*, COUNT(film.film_id) as film_count from film, film_actor, actor
        where film.film_id=film_actor.film_id and film_actor.actor_id=actor.actor_id
        group by actor.actor_id
        order by Count(film.film_id) DESC
        limit 5`,
        (err, rows2, fields) => {
          console.log(rows)
          console.log(rows2)
          connection.query(`select city from city`, (err, rows3, fields) => {
            socket.emit("queries", { "movies": rows, "actors": rows2, cities: rows3.map((city) => { return city.city }) })
          })
        })
    })
  socket.on('movieSearch', (search) => {
    if (search.param == "Name") {
      connection.query(
        `select * from film
        where title like '%${search.input}%'
        limit 100`,
        (err, rows, fields) => {
          socket.emit("movieRes", rows)
        })
    }
    if (search.param == "Actor") {
      connection.query(
        `select film.* from film, film_actor, actor
        where film.film_id=film_actor.film_id and film_actor.actor_id=actor.actor_id
        and concat(first_name," ",last_name)='${search.input}'
        limit 100`,
        (err, rows, fields) => {
          socket.emit("movieRes", rows)
        })
    }
    if (search.param == "Genre") {
      connection.query(
        `select film.* from film, film_category, category
        where film.film_id=film_category.film_id and film_category.category_id=category.category_id
        and name='${search.input}'`,
        (err, rows, fields) => {
          socket.emit("movieRes", rows)
        })
    }
  })
  socket.on('custSearch', (searchParams) => {
    connection.query(
      `select customer.*,address.*, group_concat(IF(return_date is null, title, NULL)) as rented from inventory, rental, customer,film, address
        where inventory.inventory_id=rental.inventory_id and rental.customer_id=customer.customer_id and film.film_id=inventory.film_id and address.address_id=customer.address_id
        and (customer.customer_id='${searchParams.ID}' or '${searchParams.ID}'='undefined')
        and (customer.first_name='${searchParams.First}' or '${searchParams.First}'='undefined')
        and (customer.last_name='${searchParams.Last}' or '${searchParams.Last}'='undefined')
        group by customer.customer_id
        union
        select customer.*,address.*,null from customer,address
        where address.address_id=customer.address_id
        and (customer.customer_id='${searchParams.ID}' or '${searchParams.ID}'='undefined')
        and (customer.first_name='${searchParams.First}' or '${searchParams.First}'='undefined')
        and (customer.last_name='${searchParams.Last}' or '${searchParams.Last}'='undefined')
        `,
      (err, rows, fields) => {
        socket.emit("customerRes", rows)
      })
  })
  socket.on('pdfGen', () => {
    connection.query(
      `select customer.*,group_concat(IF(return_date is null, title, NULL)) as rented from inventory, rental, customer,film
      where inventory.inventory_id=rental.inventory_id and rental.customer_id=customer.customer_id and film.film_id=inventory.film_id
      group by customer.customer_id
      having count(IF(return_date is null, title, NULL))
      `, (err, rows, fields) => {
      socket.emit("pdfRes", rows)
    })
  })
  socket.on('custRent', (params) => {
    connection.query(
      `
            select customer.* from customer, staff
      where customer.first_name='${params.customer.split(" ")[0]}' and customer.last_name='${params.customer.split(" ")[1]}'
      and customer.active=1 and staff.active=1 and staff.store_id=customer.store_id and staff.staff_id=${params.staff}
      `, (err, rows, fields) => {
      if (rows == undefined || rows.length == 0) {
        socket.emit("custResp", false, "Both the customer and staff must be active members of the same store")
      }
      else {
        connection.query(`select * from inventory as I
          where store_id=${rows[0].store_id} and film_id=${params.film} and 
          not exists
          (select * from rental 
            where rental.inventory_id=I.inventory_id and return_date is null
             )`, (err, rows2, fields) => {
          if (rows2 == undefined || rows2.length == 0) {
            socket.emit("custResp", false, "This movie is not currently available at this store")
          }
          else {
            connection.query(`insert into rental (rental_date, inventory_id, customer_id,staff_id,last_update)
                values (now(), ${rows2[0].inventory_id},${rows[0].customer_id},${params.staff},now())`, () => {
              socket.emit("custResp", true)
            })
          }
        })
      }
    })
  })
  socket.on('deleteCust', (custID) => {
    connection.query(`delete from payment where customer_id=${custID}`, () => {
      connection.query(`delete from rental where customer_id=${custID}`, () => {
        connection.query(`delete from customer where customer_id=${custID}`, () => {
          socket.emit('deleteConf')
        })
      })
    })
  }),
    socket.on('finRent', (movie, customer_id) => {
      connection.query(`select inventory.inventory_id from film,inventory,rental
    where film.title='${movie}' and film.film_id=inventory.film_id and 
    inventory.inventory_id=rental.inventory_id and rental.customer_id=${customer_id} and return_date is null`, (err, rows, fields) => {
        connection.query(`update rental set return_date=now() where customer_id=${customer_id} and inventory_id=${rows[0].inventory_id}`, () => {
          socket.emit('rentConf')
        })
      })
    })
  socket.on('addCust', (params) => {

    connection.query(`select city_id from city where city='${params.city}'`, (err, cityId, fields) => {
      connection.query(`insert into address (address,address2,district,city_id,postal_code,phone,last_update) values ('${params.address}','${params.address2}','${params.district}',${cityId[0].city_id},${params.postalCode},${params.phone},now())`, (err, rows, fields) => {
        connection.query(`insert into customer (store_id,first_name,last_name,email,address_id,active,create_date,last_update) values (${params.store},'${params.firstName}','${params.lastName}','${params.email}',last_insert_id(),1,now(),now())`, () => {
          socket.emit('addConf')
        })
      })
    })
  })
  socket.on('upCust',(params)=>{
    let name=params.customer.split(" ")
    if(name.length!=2){
      socket.emit('upConf',"Error: Invalid Name")
    }
    connection.query(`select * from customer where first_name='${name[0]}' and last_name='${name[1]}'`,(err,cust,fields)=>{
      if(cust.length==0){
        socket.emit('upConf',"Error: Invalid Name")
      }
      else{
        connection.query(`update customer set 
        first_name=case when '${params.firstName}'!='undefined' then '${params.firstName}' else first_name end,
        last_name=case when '${params.lastName}'!='undefined' then '${params.lastName}' else last_name end,
        store_id=case when '${params.store}'!='undefined' then '${params.store}' else store_id end,
        email=case when '${params.email}'!='undefined' then '${params.email}' else email end,
        last_update=now()
        where customer_id=${cust[0].customer_id}
        `,()=>{
          connection.query(`update address set
          address=case when '${params.address}'!='undefined' then '${params.address}' else address end,
          address2=case when '${params.address2}'!='undefined' then '${params.address2}' else address2 end,
          district=case when '${params.district}'!='undefined' then '${params.district}' else district end,
          postal_code=case when '${params.postalCode}'!='undefined' then '${params.postalCode}' else postal_code end,
          phone=case when '${params.phone}'!='undefined' then '${params.phone}' else phone end
          where address_id=${cust[0].address_id}`,()=>{
           
              connection.query(`select * from city where city='${params.city}'`,(err,rows,fields)=>{
                if(rows.length!=0){
                  connection.query(`update address set city_id=${rows[0].city_id} where address_id=${cust[0].address_id}`,()=>{
                    socket.emit('upConf',"Successfully updated "+params.type)
                  })
                }
                else if(params.city!=undefined){
                  socket.emit('upConf',"Choose a valid city")
                }
                else{
                  socket.emit('upConf',"Successfully updated "+params.type)
                }
              })
          })
        })
      
      }  
    })
  })
});

