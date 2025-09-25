import { initPG, createTables } from './db';
require('dotenv').config();

module.exports = async () => {
  const CLIENT_PG = await initPG('test');
  await createTables(CLIENT_PG);
  await CLIENT_PG.query(`insert into account (userid, username, email, password, salt)\
\ \ values ('${process.env._TEST_USERID}', 'foobar', 'foobar@example.com',\
\ \ '146ac20e1a62c07bc57d7ce563a9d27f0e67d81d50463b0edda7ca00c6e75d3d', 'f9f087de76da49429146dedf3fb59342')`);
  await CLIENT_PG.end();
}
