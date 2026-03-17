import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import org.bson.Document;

public class MongoTest {
    public static void main(String[] args) {
        String uri = "mongodb+srv://rasikashree1991_db_user:89nF4vUXkh1n4VIR@cluster0.xz5ld8l.mongodb.net/smartstock?retryWrites=true&w=majority";
        
        System.out.println("Testing MongoDB Atlas Connection...");
        System.out.println("URI: " + uri);
        System.out.println();
        
        try {
            System.out.println("[1/3] Creating MongoDB client...");
            MongoClient mongoClient = MongoClients.create(uri);
            
            System.out.println("[2/3] Executing ping command...");
            var database = mongoClient.getDatabase("smartstock");
            var result = database.runCommand(new Document("ping", 1));
            
            System.out.println("[3/3] ✅ SUCCESS! Connected to MongoDB Atlas");
            System.out.println("Ping result: " + result);
            mongoClient.close();
            
        } catch (Exception e) {
            System.out.println("❌ CONNECTION FAILED");
            System.out.println("Error Type: " + e.getClass().getSimpleName());
            System.out.println("Error Message: " + e.getMessage());
            System.out.println();
            System.out.println("Root Cause:");
            if (e.getCause() != null) {
                System.out.println("  " + e.getCause().getClass().getSimpleName() + ": " + e.getCause().getMessage());
            }
            System.out.println();
            System.out.println("POSSIBLE CAUSES:");
            System.out.println("1. IP Whitelist - Add your IP in MongoDB Atlas Network Access");
            System.out.println("2. Wrong Password - Verify the password in your MongoDB Atlas account");
            System.out.println("3. Wrong Username - Verify the username exists in your database");
            System.out.println("4. Cluster Paused - Check if your cluster is active");
            System.out.println("5. Network Issue - Check your internet connection");
            System.out.println();
            e.printStackTrace();
        }
    }
}
