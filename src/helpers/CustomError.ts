export class CustomError extends Error {
    public statusCode: number;
  
    constructor(message: string = "Algo ha salido mal", statusCode: number = 500) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  