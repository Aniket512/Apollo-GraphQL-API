require('dotenv').config();
const { ApolloServer, gql, UserInputError } = require("apollo-server");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const knex = require("knex")({
  client: "pg",
  connection : {
    host: "localhost",
    port: 5432,
    user: "postgres",
    password: process.env.PSQL_PASSWORD,
    database: "user"
  }
})

const typeDefs = gql`
  
  input inputWeather {
    temp: Float
	  humidity: Float
  }

  type Weather {
	temp: Float
	humidity: Float
  }

  type Account {
    bank: String
	  branch: String
	  address: String
	  city: String
	  district: String
	  state: String
	  bank_code: String
    weather: Weather
  }

  input inputAccount
  {
    ifsc: String
    bank: String
	  branch: String
	  address: String
	  city: String
	  district: String
	  state: String
	  bank_code: String
    weather: inputWeather
  }

  input inputUser {
    user_id : Int
    user_name: String
    bank_accounts : [String]
    accounts : [inputAccount]
  }

  type User {
    id : Int
    name : String
    ifsc : [String]
    accounts : [Account]

  }
  type Query {
    users: [User]
    
  }
  
  type Mutation {
    addAccountDetails(data : inputUser) : User
  }
`;


const resolvers = {
    Query: {
        users: () => knex("user_data").select("*")
    },
    Mutation: {
        addAccountDetails: async (parent, args) => {
            const res = JSON.parse(JSON.stringify(args));
            const ifsc = res.data.bank_accounts;
            const account = [];

            await Promise.all(ifsc.map(async(ifsc)=>{

              const response = await fetch("https://ifsc.razorpay.com/" + ifsc);
              const bankDetails = await response.json();
              const apiKey = "46ce58f9349fcb4bdcf0e951999bbd24";
              const weatherResponse = await fetch("https://api.openweathermap.org/data/2.5/weather?q=" + bankDetails.CITY + "&units=metric&appid=" + process.env.API_KEY);
              const weatherData = await weatherResponse.json();
              account.push({
                bank: bankDetails.BANK,
                city: bankDetails.CITY,
                district: bankDetails.DISTRICT,
                branch: bankDetails.BRANCH,
                address: bankDetails.ADDRESS,
                state: bankDetails.STATE,
                bank_code: bankDetails.BANKCODE,
                weather: {
                  temp: weatherData.main.temp,
                  humidity: weatherData.main.humidity
                }
            })
            }));

            const newUserData = {
                    id: res.data.user_id,
                    name: res.data.user_name,
                    ifsc: res.data.ifsc,
                    accounts: account
            
            }

            knex("user_data").insert({id: res.data.user_id,
              name: res.data.user_name,
              accounts: JSON.stringify(account)})
              .onConflict('id')
              .merge()
              .then( function () {
                console.log("ok");
              });

            res.data = {...res.data, accounts: account};
            return newUserData;
        }
    }
}

const server = new ApolloServer({ typeDefs, resolvers });

server.listen().then(({ url }) => {
    console.log(`🚀  Server ready at ${url}`);
});
