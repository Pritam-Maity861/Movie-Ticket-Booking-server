class ApiResponse<T> {
    statusCode: number;
    data: T;
    message: string;
    success: boolean;
  
    constructor(statusCode: number, data: T, message: string = "Success") {
      this.statusCode = statusCode;
      this.data = data;
      this.message = message;
      this.success = statusCode < 400;
    }
  
    static success<T>(res: any, data: T, message: string = "Success"): void {
      res.status(200).json(new ApiResponse(200, data, message));
    }
  
    static created<T>(res: any, data: T, message: string = "Created successfully"): void {
      res.status(201).json(new ApiResponse(201, data, message));
    }
  
    static noContent(res: any, message: string = "No content"): void {
      res.status(204).json(new ApiResponse(204, null, message));
    }
  }
  
  export { ApiResponse };
  