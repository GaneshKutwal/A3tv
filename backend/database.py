"""Database module for DynamoDB operations"""
import boto3
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from boto3.dynamodb.conditions import Key
from config import settings

logger = logging.getLogger(__name__)

COMPLAINT_COUNTER_KEY = {
    'PK': 'COUNTER#COMPLAINT',
    'SK': 'COUNTER',
}
COMPLAINT_ID_START = 1041

# DynamoDB client
dynamodb = None
table = None

async def init_dynamodb():
    """Initialize DynamoDB client and table"""
    global dynamodb, table
    
    try:
        dynamodb = boto3.resource('dynamodb', region_name=settings.AWS_REGION)
        
        table = dynamodb.Table(settings.DYNAMODB_TABLE_NAME)
        logger.info(f"Connected to DynamoDB table: {settings.DYNAMODB_TABLE_NAME}")
    except Exception as e:
        logger.error(f"Failed to initialize DynamoDB: {str(e)}")
        raise

def get_table():
    """Get DynamoDB table instance"""
    if table is None:
        raise RuntimeError("DynamoDB not initialized")
    return table

def scan_all_items(tbl) -> List[Dict[str, Any]]:
    """Read every item from the shared table across DynamoDB scan pages."""
    items = []
    scan_parameters = {}
    while True:
        response = tbl.scan(**scan_parameters)
        items.extend(response.get('Items', []))
        last_key = response.get('LastEvaluatedKey')
        if not last_key:
            return items
        scan_parameters = {'ExclusiveStartKey': last_key}

async def create_warranty(warranty_data: Dict[str, Any]) -> Dict[str, Any]:
    """Create warranty item in DynamoDB"""
    tbl = get_table()
    try:
        item = {
            'PK': f"SERIAL#{warranty_data['serialNumber']}",
            'SK': f"WARRANTY#{warranty_data['warrantyId']}",
            'EntityId': warranty_data['warrantyId'],
            'EntityType': 'WARRANTY',
            'UserId': warranty_data['userId'],
            'SerialNumber': warranty_data['serialNumber'],
            'ProductName': warranty_data['productName'],
            'ProductCategory': warranty_data['productCategory'],
            'PurchaseDate': warranty_data['purchaseDate'],
            'WarrantyEndDate': warranty_data['warrantyEndDate'],
            'Status': 'ACTIVE',
            'CreatedAt': datetime.utcnow().isoformat(),
            'UpdatedAt': datetime.utcnow().isoformat(),
        }
        invoice_paths = warranty_data.get('invoicePaths', [])
        if invoice_paths:
            item['InvoicePaths'] = invoice_paths
            item['InvoicePath'] = invoice_paths[0]
        
        # Optional customer and dealer fields
        for field in ['customerName', 'phone', 'email', 'address', 'dealerName', 'dealerLocation']:
            if field in warranty_data and warranty_data[field]:
                # Capitalize first letter to match schema style (e.g. customerName -> CustomerName)
                db_field = field[0].upper() + field[1:]
                item[db_field] = warranty_data[field]
        
        tbl.put_item(Item=item)
        logger.info(f"Created warranty: {warranty_data['warrantyId']}")
        return item
    except Exception as e:
        logger.error(f"Error creating warranty: {str(e)}")
        raise

async def get_warranties(user_id: str, filters: Optional[Dict] = None) -> List[Dict]:
    """Get all warranties with optional filters."""
    tbl = get_table()
    try:
        items = [item for item in scan_all_items(tbl) if item.get('EntityType') == 'WARRANTY']
        
        # Apply filters
        if filters:
            if filters.get('serialNumber'):
                items = [item for item in items if filters['serialNumber'].lower() in item.get('SerialNumber', '').lower()]
            if filters.get('status'):
                items = [item for item in items if item.get('Status') == filters['status']]
        
        return items
    except Exception as e:
        logger.error(f"Error getting warranties: {str(e)}")
        raise

async def get_warranty(serial_number: str) -> Optional[Dict]:
    """Get specific warranty by serial number"""
    tbl = get_table()
    try:
        response = tbl.query(
            KeyConditionExpression=Key('PK').eq(f"SERIAL#{serial_number}"),
        )
        items = response.get('Items', [])
        warranty = next((item for item in items if item.get('EntityType') == 'WARRANTY'), None)
        return warranty
    except Exception as e:
        logger.error(f"Error getting warranty: {str(e)}")
        raise

async def update_warranty(serial_number: str, update_data: Dict) -> Dict:
    """Update warranty item"""
    tbl = get_table()
    try:
        warranty = await get_warranty(serial_number)
        if not warranty:
            raise ValueError("Warranty not found")
        
        # Update item
        update_expression_parts = []
        expression_values = {}
        
        if 'productName' in update_data:
            update_expression_parts.append('ProductName = :pname')
            expression_values[':pname'] = update_data['productName']

        if 'customerName' in update_data:
            update_expression_parts.append('CustomerName = :cname')
            expression_values[':cname'] = update_data['customerName']

        if 'phone' in update_data:
            update_expression_parts.append('Phone = :phone')
            expression_values[':phone'] = update_data['phone']

        if 'email' in update_data:
            update_expression_parts.append('Email = :email')
            expression_values[':email'] = update_data['email']

        if 'address' in update_data:
            update_expression_parts.append('Address = :address')
            expression_values[':address'] = update_data['address']

        if 'dealerName' in update_data:
            update_expression_parts.append('DealerName = :dname')
            expression_values[':dname'] = update_data['dealerName']

        if 'dealerLocation' in update_data:
            update_expression_parts.append('DealerLocation = :dloc')
            expression_values[':dloc'] = update_data['dealerLocation']

        if 'purchaseDate' in update_data:
            update_expression_parts.append('PurchaseDate = :pdate')
            expression_values[':pdate'] = update_data['purchaseDate']

        if 'warrantyMonths' in update_data:
            update_expression_parts.append('WarrantyMonths = :months')
            expression_values[':months'] = update_data['warrantyMonths']

        pdate = update_data.get('purchaseDate') or warranty.get('PurchaseDate')
        wmonths = update_data.get('warrantyMonths') or warranty.get('WarrantyMonths', 24)
        if pdate and ('purchaseDate' in update_data or 'warrantyMonths' in update_data):
            try:
                parsed_pdate = datetime.fromisoformat(str(pdate)[:10])
                calculated_end = parsed_pdate + timedelta(days=int(wmonths) * 30)
                update_expression_parts.append('WarrantyEndDate = :end_date')
                expression_values[':end_date'] = calculated_end.date().isoformat()
            except Exception:
                pass

        if 'notes' in update_data:
            update_expression_parts.append('Notes = :notes')
            expression_values[':notes'] = update_data['notes']

        update_expression_parts.append('UpdatedAt = :updated')
        expression_values[':updated'] = datetime.utcnow().isoformat()
        
        response = tbl.update_item(
            Key={
                'PK': warranty['PK'],
                'SK': warranty['SK'],
            },
            UpdateExpression=f"SET {', '.join(update_expression_parts)}",
            ExpressionAttributeValues=expression_values,
            ReturnValues='ALL_NEW'
        )
        
        logger.info(f"Updated warranty for serial: {serial_number}")
        return response.get('Attributes', {})
    except Exception as e:
        logger.error(f"Error updating warranty: {str(e)}")
        raise

async def create_complaint(complaint_data: Dict[str, Any]) -> Dict[str, Any]:
    """Create complaint item in DynamoDB.

    serialNumber is optional. When absent the complaint is registered against
    the customer name so the serial can be linked later.
    """
    tbl = get_table()
    try:
        serial_number = complaint_data.get('serialNumber') or ''
        complaint_id = complaint_data['complaintId']

        # Use SERIAL# PK when serial is known, otherwise key by customer name
        if serial_number:
            pk = f"SERIAL#{serial_number}"
        else:
            customer_key = (complaint_data.get('customerName') or 'UNKNOWN').replace(' ', '_').upper()
            pk = f"CUSTOMER#{customer_key}#{complaint_id}"

        item = {
            'PK': pk,
            'SK': f"COMPLAINT#{datetime.utcnow().isoformat()}#{complaint_id}",
            'EntityId': complaint_id,
            'EntityType': 'COMPLAINT',
            'UserId': complaint_data['userId'],
            'LoggedBy': complaint_data.get('loggedBy', 'Service Desk'),
            'WarrantyId': complaint_data.get('warrantyId', ''),
            'SerialNumber': serial_number,
            'Description': complaint_data['description'],
            'Priority': complaint_data.get('priority', 'MEDIUM'),
            'Status': 'OPEN',
            'CreatedAt': datetime.utcnow().isoformat(),
            'UpdatedAt': datetime.utcnow().isoformat(),
            'AttachmentPaths': complaint_data.get('attachmentPaths', []),
            'Notes': complaint_data.get('notes', []),
        }

        # Store customer details when provided directly (name-based complaint)
        if complaint_data.get('customerName'):
            item['CustomerName'] = complaint_data['customerName']
        if complaint_data.get('phone'):
            item['Phone'] = complaint_data['phone']
        if complaint_data.get('alternatePhone'):
            item['AlternatePhone'] = complaint_data['alternatePhone']
        if complaint_data.get('assignedTo'):
            item['AssignedTo'] = complaint_data['assignedTo']
            item['Notes'].append({
                'text': f"Assigned to {complaint_data['assignedTo']}",
                'at': item['CreatedAt'],
                'by': complaint_data.get('loggedBy', 'Service Desk'),
            })
        
        tbl.put_item(Item=item)
        logger.info(f"Created complaint: {complaint_id}")
        return item
    except Exception as e:
        logger.error(f"Error creating complaint: {str(e)}")
        raise

async def generate_complaint_id() -> str:
    """Generate the next human-readable complaint identifier atomically."""
    tbl = get_table()
    try:
        response = tbl.update_item(
            Key=COMPLAINT_COUNTER_KEY,
            UpdateExpression='SET #counter = if_not_exists(#counter, :start) + :increment',
            ExpressionAttributeNames={'#counter': 'Counter'},
            ExpressionAttributeValues={':start': COMPLAINT_ID_START, ':increment': 1},
            ReturnValues='UPDATED_NEW',
        )
        sequence = response['Attributes']['Counter']
        return f'CMP-{int(sequence):04d}'
    except Exception as e:
        logger.error(f"Error generating complaint ID: {str(e)}")
        raise

async def get_complaints(user_id: str, filters: Optional[Dict] = None) -> List[Dict]:
    """Get all complaints with optional filters."""
    tbl = get_table()
    try:
        items = [item for item in scan_all_items(tbl) if item.get('EntityType') == 'COMPLAINT']
        
        # Apply filters
        if filters:
            if filters.get('serialNumber'):
                items = [item for item in items if filters['serialNumber'].lower() in item.get('SerialNumber', '').lower()]
            if filters.get('customerName'):
                items = [item for item in items if filters['customerName'].lower() in item.get('CustomerName', '').lower()]
            if filters.get('status'):
                items = [item for item in items if item.get('Status') == filters['status']]
            if filters.get('priority'):
                items = [item for item in items if item.get('Priority', '').upper() == filters['priority'].upper()]
        
        return items
    except Exception as e:
        logger.error(f"Error getting complaints: {str(e)}")
        raise

async def get_complaint(user_id: str, complaint_id: str) -> Optional[Dict]:
    """Get a complaint by ID from the shared service-desk data."""
    tbl = get_table()
    try:
        items = scan_all_items(tbl)
        complaint = next((item for item in items if item.get('EntityId') == complaint_id and item.get('EntityType') == 'COMPLAINT'), None)
        return complaint
    except Exception as e:
        logger.error(f"Error getting complaint: {str(e)}")
        raise

async def update_complaint(user_id: str, complaint_id: str, update_data: Dict) -> Dict:
    """Update complaint item.
    
    When a serial number is added to a name-based complaint (created without serial),
    the complaint is migrated from CUSTOMER# partition to SERIAL# partition for consistency.
    """
    tbl = get_table()
    try:
        complaint = await get_complaint(user_id, complaint_id)
        if not complaint:
            raise ValueError("Complaint not found")
        
        # Check if we're adding a serial number to a customer-keyed complaint
        old_pk = complaint.get('PK', '')
        old_sk = complaint.get('SK', '')
        new_serial_number = update_data.get('serialNumber', '').strip() if 'serialNumber' in update_data else None
        current_serial = complaint.get('SerialNumber', '')
        
        # If moving from CUSTOMER partition to SERIAL partition
        needs_migration = (
            old_pk.startswith('CUSTOMER#') and 
            new_serial_number and 
            new_serial_number != current_serial
        )
        
        # Update item
        update_expression_parts = []
        expression_values = {}
        expression_names = {}
        new_notes = []
        
        if 'description' in update_data:
            update_expression_parts.append('Description = :desc')
            expression_values[':desc'] = update_data['description']

        if 'priority' in update_data:
            update_expression_parts.append('Priority = :priority')
            expression_values[':priority'] = update_data['priority']

        # Allow linking a serial number to a name-based complaint
        if 'serialNumber' in update_data and update_data['serialNumber']:
            update_expression_parts.append('SerialNumber = :serial')
            expression_values[':serial'] = update_data['serialNumber']

        if 'customerName' in update_data:
            update_expression_parts.append('CustomerName = :cname')
            expression_values[':cname'] = update_data['customerName']

        if 'phone' in update_data:
            update_expression_parts.append('Phone = :phone')
            expression_values[':phone'] = update_data['phone']

        if 'alternatePhone' in update_data:
            update_expression_parts.append('AlternatePhone = :alt_phone')
            expression_values[':alt_phone'] = update_data['alternatePhone']

        if 'assignedTo' in update_data:
            update_expression_parts.append('AssignedTo = :assigned_to')
            expression_values[':assigned_to'] = update_data['assignedTo']
            previous_assignee = complaint.get('AssignedTo')
            next_assignee = update_data['assignedTo']
            if previous_assignee != next_assignee:
                assignment_text = (
                    f"Assigned to {next_assignee}"
                    if next_assignee
                    else "Assignment cleared"
                )
                new_notes.append({
                    'text': assignment_text,
                    'at': datetime.utcnow().isoformat(),
                    'by': update_data.get('noteBy', 'Service Desk'),
                })
        
        if 'status' in update_data:
            update_expression_parts.append('#status = :status')
            expression_values[':status'] = update_data['status']
            expression_names['#status'] = 'Status'
            if update_data['status'] == 'RESOLVED':
                update_expression_parts.append('ResolvedAt = :resolved')
                expression_values[':resolved'] = datetime.utcnow().isoformat()
        
        if 'resolutionNotes' in update_data:
            update_expression_parts.append('ResolutionNotes = :notes')
            expression_values[':notes'] = update_data['resolutionNotes']

        if 'attachmentPaths' in update_data:
            update_expression_parts.append('AttachmentPaths = :attachments')
            expression_values[':attachments'] = update_data['attachmentPaths']

        if 'note' in update_data and update_data['note']:
            new_notes.append(update_data['note'])

        if new_notes:
            update_expression_parts.append(
                'Notes = list_append(if_not_exists(Notes, :empty_notes), :new_notes)'
            )
            expression_values[':empty_notes'] = []
            expression_values[':new_notes'] = new_notes
        
        update_expression_parts.append('UpdatedAt = :updated')
        expression_values[':updated'] = datetime.utcnow().isoformat()
        
        # If migration is needed, handle the partition key change
        if needs_migration:
            # First, update the old item in place
            update_parameters = dict(
                Key={
                    'PK': old_pk,
                    'SK': old_sk,
                },
                UpdateExpression=f"SET {', '.join(update_expression_parts)}",
                ExpressionAttributeValues=expression_values,
                ReturnValues='ALL_NEW'
            )
            if expression_names:
                update_parameters['ExpressionAttributeNames'] = expression_names
            
            response = tbl.update_item(**update_parameters)
            updated_item = response.get('Attributes', {})
            
            # Create new item with correct SERIAL# partition key
            new_pk = f"SERIAL#{new_serial_number}"
            new_sk = f"COMPLAINT#{datetime.utcnow().isoformat()}#{complaint_id}"
            
            new_item = updated_item.copy()
            new_item['PK'] = new_pk
            new_item['SK'] = new_sk
            
            # Put the new item
            tbl.put_item(Item=new_item)
            logger.info(f"Migrated complaint {complaint_id} from {old_pk} to {new_pk}")
            
            # Delete the old item
            tbl.delete_item(Key={'PK': old_pk, 'SK': old_sk})
            logger.info(f"Deleted old complaint item at {old_pk}")
            
            return new_item
        else:
            # Standard update without migration
            update_parameters = dict(
                Key={
                    'PK': complaint['PK'],
                    'SK': complaint['SK'],
                },
                UpdateExpression=f"SET {', '.join(update_expression_parts)}",
                ExpressionAttributeValues=expression_values,
                ReturnValues='ALL_NEW'
            )
            if expression_names:
                update_parameters['ExpressionAttributeNames'] = expression_names

            response = tbl.update_item(**update_parameters)
            
            logger.info(f"Updated complaint: {complaint_id}")
            return response.get('Attributes', {})
    except Exception as e:
        logger.error(f"Error updating complaint: {str(e)}")
        raise

async def get_dashboard_stats(user_id: str) -> Dict:
    """Get dashboard statistics"""
    warranties = await get_warranties(user_id)
    complaints = await get_complaints(user_id)
    
    open_complaints = [c for c in complaints if c.get('Status') == 'OPEN']
    resolved_complaints = [c for c in complaints if c.get('Status') == 'RESOLVED']
    pending_complaints = [c for c in complaints if c.get('Status') == 'PENDING']
    active_warranties = [w for w in warranties if w.get('Status') == 'ACTIVE']
    expired_warranties = [w for w in warranties if w.get('Status') == 'EXPIRED']
    
    return {
        'totalWarranties': len(warranties),
        'totalComplaints': len(complaints),
        'openComplaints': len(open_complaints),
        'resolvedComplaints': len(resolved_complaints),
        'pendingComplaints': len(pending_complaints),
        'activeWarranties': len(active_warranties),
        'expiredWarranties': len(expired_warranties),
    }
