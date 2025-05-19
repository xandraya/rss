import { initPg, createTables } from './db';

module.exports = async () => {
  const clientPg = await initPg('test');
  await createTables(clientPg);
  await clientPg.query(`insert into account (userid, username, email, password, salt)\
\ \ values ('adf8c2ee050b2173', 'foobar', 'foobar@example.com',\
\ \ '146ac20e1a62c07bc57d7ce563a9d27f0e67d81d50463b0edda7ca00c6e75d3d', 'f9f087de76da49429146dedf3fb59342')`);
  await clientPg.query(`insert into folder (folderid, userid, name) values ('2b9d34170d53c39a', 'adf8c2ee050b2173', 'existingfolder')`);
  await clientPg.end();
}
