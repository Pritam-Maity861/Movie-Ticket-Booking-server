import { Request, Response } from "express";
import { AdminService } from "./admin.service";

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const data = await AdminService.getDashboardStats();
    res.status(200).json({
      success: true,
      message: "Dashboard stats fetched successfully",
      data,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const data = await AdminService.getAllUsers();
    res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const updateUserRole = async (req: Request, res: Response) => {
  try {
    const { userId, role } = req.body;
    const data = await AdminService.updateUserRole(userId, role);
    res.status(200).json({
      success: true,
      message: "User role updated successfully",
      data,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = await AdminService.deleteUser(id as string);
    res.status(200).json({
      success: true,
      message: "User deleted successfully",
      data,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};
