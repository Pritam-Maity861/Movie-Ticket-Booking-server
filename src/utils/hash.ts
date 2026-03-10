import bcrypt from "bcrypt";

export const hashData=async (data:string)=>{
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(data, salt);
}

export const compareHash=async (data:string,hashedData:string)=>{
    return await bcrypt.compare(data, hashedData);
}
