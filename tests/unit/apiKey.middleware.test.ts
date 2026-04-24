import { Request, Response } from "express";
import { apiKey } from "../../src/middleware/apiKey.middleware";

describe("apiKey Middleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    process.env.API_KEYS = "test-key-1, test-key-2";
    mockRequest = {
      headers: {},
      ip: "127.0.0.1",
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    nextFunction = jest.fn();
  });

  it("should call next() if valid API key is provided", () => {
    mockRequest.headers!["x-api-key"] = "test-key-1";
    apiKey(mockRequest as Request, mockResponse as Response, nextFunction);
    expect(nextFunction).toHaveBeenCalled();
  });

  it("should return 401 if API key is missing", () => {
    apiKey(mockRequest as Request, mockResponse as Response, nextFunction);
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      message: "API key is required.",
    });
  });

  it("should return 403 if API key is invalid", () => {
    mockRequest.headers!["x-api-key"] = "wrong-key";
    apiKey(mockRequest as Request, mockResponse as Response, nextFunction);
    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      message: "Invalid API key.",
    });
  });
});
