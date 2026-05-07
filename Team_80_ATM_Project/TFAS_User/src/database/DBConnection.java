package database;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class DBConnection {
public static Connection con=null;
public static Connection getConnection() throws ClassNotFoundException, SQLException{
	
	Class.forName("com.mysql.jdbc.Driver");
	con=DriverManager.getConnection("jdbc:mysql://localhost:3307/atm","root","root");
	return con;
}

}
