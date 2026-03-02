import Razorpay from "razorpay"
import axios from "axios";


const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});


export const rzpx = axios.create({
  baseURL: "https://api.razorpay.com",
  auth: {
    username: process.env.RAZORPAY_KEY_ID,
    password: process.env.RAZORPAY_KEY_SECRET,
  },
});


export default razorpayInstance